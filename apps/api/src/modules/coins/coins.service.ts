import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';

import { type CoinTransactionRow } from './coins.constants';
import { InsufficientBalanceError } from './insufficient-balance.exception';

export type AdjustResult = { balance: number; transactionId: string };

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

type DbClient = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class CoinsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Atomically adjust a user's coin balance and write the matching
   * `coin_transactions` audit row.
   *
   * - amount > 0 → grant
   * - amount < 0 → spend; throws `InsufficientBalanceError` if the balance
   *   would go negative
   * - amount === 0 → no-op (returns current balance, no audit row)
   *
   * The atomic guard is `prisma.user.updateMany` with a `coinBalance: gte`
   * predicate — Postgres applies the predicate inside the same row lock
   * that would otherwise allow a concurrent reader to read-then-write a
   * stale balance. Tested with parallel calls in coins.service.spec.ts.
   *
   * Pass `tx` to participate in an outer transaction so the balance
   * update and the caller's downstream writes commit or roll back together.
   */
  async adjustBalance(
    userId: string,
    amount: number,
    type: string,
    relatedId: string | null = null,
    tx?: Prisma.TransactionClient,
  ): Promise<AdjustResult> {
    const client: DbClient = tx ?? this.prisma;

    if (amount === 0) {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true, deletedAt: true },
      });
      if (!user || user.deletedAt) throw new NotFoundException('User not found');
      return { balance: user.coinBalance, transactionId: '' };
    }

    if (amount < 0) {
      const cost = -amount;
      const result = await client.user.updateMany({
        where: {
          id: userId,
          deletedAt: null,
          coinBalance: { gte: cost },
        },
        data: { coinBalance: { increment: amount } },
      });
      if (result.count === 0) {
        const user = await client.user.findUnique({
          where: { id: userId },
          select: { coinBalance: true, deletedAt: true },
        });
        if (!user || user.deletedAt) throw new NotFoundException('User not found');
        throw new InsufficientBalanceError(cost, user.coinBalance);
      }
    } else {
      const result = await client.user.updateMany({
        where: { id: userId, deletedAt: null },
        data: { coinBalance: { increment: amount } },
      });
      if (result.count === 0) {
        throw new NotFoundException('User not found');
      }
    }

    const user = await client.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const txn = await client.coinTransaction.create({
      data: {
        userId,
        amount,
        type,
        relatedId,
        balanceAfter: user.coinBalance,
      },
      select: { id: true },
    });
    return { balance: user.coinBalance, transactionId: txn.id };
  }

  async getBalance(userId: string): Promise<{ coinBalance: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return { coinBalance: user.coinBalance };
  }

  async listTransactions(
    userId: string,
    page: number = DEFAULT_PAGE,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<{
    items: CoinTransactionRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.coinTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          type: true,
          relatedId: true,
          balanceAfter: true,
          createdAt: true,
        },
      }),
      this.prisma.coinTransaction.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
