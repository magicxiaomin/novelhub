import type { PrismaClient } from '@prisma/client';

import { DomainError } from '../../common/domain.errors';
import { SUBSCRIPTION_ACTIVE_STATUSES } from '../auth/auth.constants';
import { COIN_TXN_TYPE } from '../coins/coins.constants';
import type { CoinsService } from '../coins/coins.service';
import { InsufficientBalanceError } from '../coins/insufficient-balance.exception';

import { UNLOCK_METHOD, type UnlockListItem, type UnlockResponse } from './unlocks.constants';

export type UnlocksServiceDeps = {
  prisma: PrismaClient;
  coins: CoinsService;
};

export class UnlocksService {
  private readonly prisma: PrismaClient;
  private readonly coins: CoinsService;

  constructor(deps: UnlocksServiceDeps) {
    this.prisma = deps.prisma;
    this.coins = deps.coins;
  }

  /**
   * Unlock a chapter for the user.
   *
   * - Free chapters: 400 (clients should not call this; the chapter is open).
   * - Already unlocked: returns the existing row (idempotent).
   * - Active subscription: writes an unlock with method=SUBSCRIPTION and no coin charge.
   * - Otherwise: spends `book.coinPerChapter` from the user's balance and
   *   writes a method=COINS unlock. The spend + unlock happen inside one
   *   `$transaction` so a partial failure can never leave coins debited
   *   without an unlock or vice versa.
   * - Insufficient balance: throws `DomainError(402)` with the paywall context
   *   ({ chapterId, coinCost, currentBalance }) the filter merges into the body.
   */
  async unlockChapter(userId: string, chapterId: string): Promise<UnlockResponse> {
    const existing = await this.prisma.chapterUnlock.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
      select: { id: true, chapterId: true, method: true, unlockedAt: true },
    });
    if (existing) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: chapterId },
        select: { bookId: true },
      });
      return {
        id: existing.id,
        chapterId: existing.chapterId,
        bookId: chapter?.bookId ?? '',
        method: existing.method as UnlockResponse['method'],
        unlockedAt: existing.unlockedAt,
      };
    }

    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, deletedAt: null },
      include: {
        book: { select: { id: true, coinPerChapter: true, deletedAt: true } },
      },
    });
    if (!chapter || chapter.book.deletedAt !== null) {
      throw DomainError.notFound('Chapter not found');
    }
    if (chapter.isFree) {
      throw DomainError.badRequest('Chapter is already free; no unlock needed');
    }

    if (await this.hasActiveSubscription(userId)) {
      const created = await this.prisma.chapterUnlock.create({
        data: { userId, chapterId, method: UNLOCK_METHOD.SUBSCRIPTION },
        select: { id: true, chapterId: true, method: true, unlockedAt: true },
      });
      return {
        id: created.id,
        chapterId: created.chapterId,
        bookId: chapter.bookId,
        method: UNLOCK_METHOD.SUBSCRIPTION,
        unlockedAt: created.unlockedAt,
      };
    }

    const cost = chapter.book.coinPerChapter;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.coins.adjustBalance(userId, -cost, COIN_TXN_TYPE.CHAPTER_UNLOCK, chapterId, tx);
        return tx.chapterUnlock.create({
          data: { userId, chapterId, method: UNLOCK_METHOD.COINS },
          select: { id: true, chapterId: true, method: true, unlockedAt: true },
        });
      });
      return {
        id: created.id,
        chapterId: created.chapterId,
        bookId: chapter.bookId,
        method: UNLOCK_METHOD.COINS,
        unlockedAt: created.unlockedAt,
      };
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        throw DomainError.paymentRequired('Insufficient coin balance', {
          chapterId,
          coinCost: err.required,
          currentBalance: err.current,
        });
      }
      // Concurrent unique-constraint hit: someone else just unlocked this
      // chapter for the same user. Treat as idempotent success.
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
        const existing2 = await this.prisma.chapterUnlock.findUnique({
          where: { userId_chapterId: { userId, chapterId } },
          select: { id: true, chapterId: true, method: true, unlockedAt: true },
        });
        if (existing2) {
          return {
            id: existing2.id,
            chapterId: existing2.chapterId,
            bookId: chapter.bookId,
            method: existing2.method as UnlockResponse['method'],
            unlockedAt: existing2.unlockedAt,
          };
        }
      }
      throw err;
    }
  }

  async list(
    userId: string,
    page: number = 1,
    limit: number = 20,
    bookId?: string,
  ): Promise<{
    items: UnlockListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where = bookId ? { userId, chapter: { bookId } } : { userId };
    const [items, total] = await Promise.all([
      this.prisma.chapterUnlock.findMany({
        where,
        orderBy: { unlockedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          chapterId: true,
          method: true,
          unlockedAt: true,
        },
      }),
      this.prisma.chapterUnlock.count({ where }),
    ]);
    return { items, total, page, limit };
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
}
