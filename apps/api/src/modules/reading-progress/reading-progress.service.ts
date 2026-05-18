import type { PrismaClient } from '@prisma/client';

import { DomainError } from '../../common/domain.errors';
import { SUBSCRIPTION_ACTIVE_STATUSES } from '../auth/auth.constants';

import type { SaveProgressDto } from './dto/save-progress.types';

export type ProgressResponse = {
  id: string;
  bookId: string;
  chapterId: string;
  scrollPercent: number;
  lastReadAt: Date;
};

export type ProgressListItem = {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  scrollPercent: number;
  bookTitle: string;
  bookCover: string;
  updatedAt: Date;
};

export type ReadingProgressServiceDeps = {
  prisma: PrismaClient;
};

export class ReadingProgressService {
  private readonly prisma: PrismaClient;

  constructor(deps: ReadingProgressServiceDeps) {
    this.prisma = deps.prisma;
  }

  async save(userId: string, dto: SaveProgressDto): Promise<ProgressResponse> {
    // Refuse to track progress for chapters the user can't actually read.
    // Returning the same 404 for "doesn't exist" and "no access" denies an
    // attacker the 200/404 oracle they would otherwise have to enumerate
    // chapter IDs.
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: dto.chapterId, deletedAt: null, book: { deletedAt: null } },
      select: { id: true, bookId: true, isFree: true },
    });
    if (!chapter || !(await this.userCanRead(userId, chapter))) {
      throw DomainError.notFound(`Chapter ${dto.chapterId} not found`);
    }

    const scrollPosition = clampScrollPercent(dto.scrollPercent);
    const now = new Date();
    const progress = await this.prisma.readingProgress.upsert({
      where: { userId_chapterId: { userId, chapterId: dto.chapterId } },
      create: {
        userId,
        bookId: chapter.bookId,
        chapterId: dto.chapterId,
        scrollPosition,
        lastReadAt: now,
      },
      update: {
        bookId: chapter.bookId,
        scrollPosition,
        lastReadAt: now,
      },
      select: {
        id: true,
        bookId: true,
        chapterId: true,
        scrollPosition: true,
        lastReadAt: true,
      },
    });
    return toProgressResponse(progress);
  }

  async findOne(
    userId: string,
    query: { bookId?: string; chapterId?: string },
  ): Promise<ProgressResponse | null> {
    const progress = await this.prisma.readingProgress.findFirst({
      where: {
        userId,
        ...(query.bookId ? { bookId: query.bookId } : {}),
        ...(query.chapterId ? { chapterId: query.chapterId } : {}),
      },
      orderBy: { lastReadAt: 'desc' },
      select: {
        id: true,
        bookId: true,
        chapterId: true,
        scrollPosition: true,
        lastReadAt: true,
      },
    });
    return progress ? toProgressResponse(progress) : null;
  }

  private async userCanRead(
    userId: string,
    chapter: { id: string; isFree: boolean },
  ): Promise<boolean> {
    if (chapter.isFree) return true;
    const [hasUnlock, hasSubscription] = await Promise.all([
      this.prisma.chapterUnlock.findUnique({
        where: { userId_chapterId: { userId, chapterId: chapter.id } },
        select: { id: true },
      }),
      this.prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] },
          currentPeriodEnd: { gt: new Date() },
        },
        select: { id: true },
      }),
    ]);
    return hasUnlock !== null || hasSubscription !== null;
  }

  async listRecent(userId: string, limit = 10): Promise<ProgressListItem[]> {
    const requestedLimit = Math.max(0, limit);
    const fetchLimit = Math.min(requestedLimit * 5, 50);
    if (fetchLimit === 0) return [];

    const rows = await this.prisma.readingProgress.findMany({
      where: { userId },
      // Over-fetch so deduping multiple chapter progress rows per book still fills the visible cap.
      orderBy: [{ lastReadAt: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
      take: fetchLimit,
      select: {
        id: true,
        bookId: true,
        chapterId: true,
        scrollPosition: true,
        updatedAt: true,
        chapter: { select: { order: true } },
        book: { select: { title: true, coverUrl: true } },
      },
    });
    const dedupedRows = Array.from(
      rows
        .reduce((byBook, row) => {
          if (!byBook.has(row.bookId)) byBook.set(row.bookId, row);
          return byBook;
        }, new Map<string, (typeof rows)[number]>())
        .values(),
    ).slice(0, requestedLimit);

    return dedupedRows.map((row) => ({
      bookId: row.bookId,
      chapterId: row.chapterId,
      chapterNumber: row.chapter.order,
      scrollPercent: row.scrollPosition,
      bookTitle: row.book.title,
      bookCover: row.book.coverUrl,
      updatedAt: row.updatedAt,
    }));
  }
}

function clampScrollPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function toProgressResponse(progress: {
  id: string;
  bookId: string;
  chapterId: string;
  scrollPosition: number;
  lastReadAt: Date;
}): ProgressResponse {
  return {
    id: progress.id,
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    scrollPercent: progress.scrollPosition,
    lastReadAt: progress.lastReadAt,
  };
}
