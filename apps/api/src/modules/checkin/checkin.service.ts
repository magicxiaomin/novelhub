import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';

import { COIN_TXN_TYPE_CHECKIN, REWARD_BY_DAY } from './checkin.constants';

export type CheckinStatus = {
  today: string;
  claimedToday: boolean;
  streakCount: number;
  nextReward: number;
  todayReward: number;
};

export type CheckinClaim = {
  streakCount: number;
  coinsAwarded: number;
  newBalance: number;
};

type RecentCheckin = {
  checkinDate: Date;
  streakCount: number;
  coinsAwarded: number;
};

@Injectable()
export class CheckinService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getStatus(userId: string): Promise<CheckinStatus> {
    const { today, yesterday, todayKey, yesterdayKey } = this.getUtcDayWindow();
    const latest = await this.findLatest(userId, this.prisma);

    if (!latest) {
      return this.buildStatus(todayKey, false, 0, rewardForStreak(1), rewardForStreak(1));
    }

    const latestKey = toIsoDate(latest.checkinDate);
    if (latestKey === todayKey) {
      return this.buildStatus(
        todayKey,
        true,
        latest.streakCount,
        rewardForStreak(latest.streakCount + 1),
        latest.coinsAwarded,
      );
    }

    if (latestKey === yesterdayKey) {
      const todayReward = rewardForStreak(latest.streakCount + 1);
      return this.buildStatus(todayKey, false, latest.streakCount, todayReward, todayReward);
    }

    if (latest.checkinDate < yesterday) {
      return this.buildStatus(todayKey, false, 0, rewardForStreak(1), rewardForStreak(1));
    }

    const todayReward = latest.checkinDate < today ? rewardForStreak(1) : latest.coinsAwarded;
    return this.buildStatus(todayKey, false, 0, todayReward, todayReward);
  }

  async claim(userId: string): Promise<CheckinClaim> {
    const { today, todayKey, yesterdayKey } = this.getUtcDayWindow();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const latest = await this.findLatest(userId, tx);
        const latestKey = latest ? toIsoDate(latest.checkinDate) : null;

        if (latestKey === todayKey) {
          throw new ConflictException('Already checked in today');
        }

        const streakCount = latestKey === yesterdayKey && latest ? latest.streakCount + 1 : 1;
        const coinsAwarded = rewardForStreak(streakCount);

        await tx.dailyCheckin.create({
          data: {
            userId,
            checkinDate: today,
            streakCount,
            coinsAwarded,
          },
        });

        const updated = await tx.user.updateMany({
          where: { id: userId, deletedAt: null },
          data: { coinBalance: { increment: coinsAwarded } },
        });
        if (updated.count === 0) {
          throw new NotFoundException('User not found');
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { coinBalance: true },
        });
        if (!user) throw new NotFoundException('User not found');

        await tx.coinTransaction.create({
          data: {
            userId,
            amount: coinsAwarded,
            type: COIN_TXN_TYPE_CHECKIN,
            relatedId: null,
            balanceAfter: user.coinBalance,
          },
        });

        return { streakCount, coinsAwarded, newBalance: user.coinBalance };
      });
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        throw new ConflictException('Already checked in today');
      }
      throw err;
    }
  }

  private async findLatest(
    userId: string,
    client: PrismaClient | Prisma.TransactionClient,
  ): Promise<RecentCheckin | null> {
    return client.dailyCheckin.findFirst({
      where: { userId },
      orderBy: { checkinDate: 'desc' },
      select: { checkinDate: true, streakCount: true, coinsAwarded: true },
    });
  }

  private getUtcDayWindow(): {
    today: Date;
    yesterday: Date;
    todayKey: string;
    yesterdayKey: string;
  } {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    return {
      today,
      yesterday,
      todayKey: toIsoDate(today),
      yesterdayKey: toIsoDate(yesterday),
    };
  }

  private buildStatus(
    today: string,
    claimedToday: boolean,
    streakCount: number,
    nextReward: number,
    todayReward: number,
  ): CheckinStatus {
    return { today, claimedToday, streakCount, nextReward, todayReward };
  }
}

const rewardForStreak = (streakCount: number): number => {
  const day = (((streakCount - 1) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  return REWARD_BY_DAY[day];
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const hasPrismaCode = (err: unknown, code: string): boolean =>
  err instanceof Error &&
  'code' in err &&
  typeof (err as { code: unknown }).code === 'string' &&
  (err as { code: string }).code === code;
