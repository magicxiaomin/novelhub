import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA, SUBSCRIPTION_ACTIVE_STATUSES } from '../auth/auth.constants';
import {
  CACHE_CLIENT,
  CHAPTER_PREVIEW_TTL_SECONDS,
  type CacheClient,
} from '../cache/cache.constants';
import {
  SIGNED_URL_TTL_SECONDS,
  STORAGE_CLIENT,
  type StorageClient,
} from '../storage/storage.constants';

import type {
  ChapterReadResponse,
  LockedChapterResponse,
  UnlockedChapterResponse,
} from './chapters.types';

const PREVIEW_LENGTH = 100;

const previewCacheKey = (chapterId: string): string => `chapter:preview:${chapterId}`;

@Injectable()
export class ChaptersService {
  private readonly logger = new Logger(ChaptersService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    @Inject(CACHE_CLIENT) private readonly cache: CacheClient,
  ) {}

  async readChapter(chapterId: string, userId: string | null): Promise<ChapterReadResponse> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, deletedAt: null },
      include: {
        book: {
          select: {
            id: true,
            coinPerChapter: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!chapter || chapter.book.deletedAt !== null) {
      throw new NotFoundException('Chapter not found');
    }

    const isUnlocked = await this.isUnlockedFor(chapter, userId);

    if (isUnlocked) {
      return this.buildUnlocked(chapter);
    }
    return this.buildLocked(chapter, userId);
  }

  private async isUnlockedFor(
    chapter: { id: string; isFree: boolean },
    userId: string | null,
  ): Promise<boolean> {
    if (chapter.isFree) return true;
    if (!userId) return false;

    const [hasSubscription, ownsUnlock] = await Promise.all([
      this.hasActiveSubscription(userId),
      this.hasChapterUnlock(userId, chapter.id),
    ]);
    return hasSubscription || ownsUnlock;
  }

  private async hasActiveSubscription(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] },
        currentPeriodEnd: { gt: new Date() },
      },
      select: { id: true },
    });
    return sub !== null;
  }

  private async hasChapterUnlock(userId: string, chapterId: string): Promise<boolean> {
    const unlock = await this.prisma.chapterUnlock.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
      select: { id: true },
    });
    return unlock !== null;
  }

  private async buildUnlocked(chapter: {
    id: string;
    bookId: string;
    order: number;
    title: string;
    contentUrl: string;
    wordCount: number;
  }): Promise<UnlockedChapterResponse> {
    const [signedUrl, prevChapter, nextChapter] = await Promise.all([
      this.signContent(chapter.contentUrl),
      this.prisma.chapter.findFirst({
        where: {
          bookId: chapter.bookId,
          deletedAt: null,
          order: { lt: chapter.order },
        },
        orderBy: { order: 'desc' },
        select: { id: true },
      }),
      this.prisma.chapter.findFirst({
        where: {
          bookId: chapter.bookId,
          deletedAt: null,
          order: { gt: chapter.order },
        },
        orderBy: { order: 'asc' },
        select: { id: true },
      }),
    ]);

    return {
      id: chapter.id,
      bookId: chapter.bookId,
      chapterNumber: chapter.order,
      title: chapter.title,
      isLocked: false,
      contentUrl: signedUrl,
      wordCount: chapter.wordCount,
      prevChapterId: prevChapter?.id ?? null,
      nextChapterId: nextChapter?.id ?? null,
    };
  }

  private async buildLocked(
    chapter: {
      id: string;
      bookId: string;
      order: number;
      title: string;
      contentUrl: string;
      book: { coinPerChapter: number };
    },
    userId: string | null,
  ): Promise<LockedChapterResponse> {
    const [preview, coinBalance, hasSub] = await Promise.all([
      this.previewFor(chapter.id, chapter.contentUrl),
      userId ? this.getCoinBalance(userId) : Promise.resolve(0),
      userId ? this.hasActiveSubscription(userId) : Promise.resolve(false),
    ]);
    const coinCost = chapter.book.coinPerChapter;
    return {
      id: chapter.id,
      bookId: chapter.bookId,
      chapterNumber: chapter.order,
      title: chapter.title,
      isLocked: true,
      preview,
      unlockOptions: {
        coinCost,
        canUnlockWithCoins: userId !== null && coinBalance >= coinCost,
        canUnlockWithSubscription: userId !== null && hasSub,
      },
    };
  }

  private async getCoinBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return 0;
    return user.coinBalance;
  }

  private async previewFor(chapterId: string, contentUrl: string): Promise<string> {
    const cached = await this.cache.get<string>(previewCacheKey(chapterId));
    if (cached !== null) return cached;
    let preview = '';
    try {
      const text = await this.storage.getText(contentUrl);
      preview = text.slice(0, PREVIEW_LENGTH);
    } catch (err) {
      this.logger.warn(`Failed to read preview for ${chapterId}: ${(err as Error).message}`);
      preview = '';
    }
    await this.cache.set(previewCacheKey(chapterId), preview, CHAPTER_PREVIEW_TTL_SECONDS);
    return preview;
  }

  private async signContent(contentUrl: string): Promise<string> {
    try {
      return await this.storage.getSignedUrl(contentUrl, SIGNED_URL_TTL_SECONDS);
    } catch (err) {
      this.logger.error(`Failed to sign content URL ${contentUrl}: ${(err as Error).message}`);
      // If signing fails (e.g. R2 unconfigured in tests), fall back to the raw key.
      return contentUrl;
    }
  }
}
