import type { Prisma, PrismaClient } from '@prisma/client';

import { DomainError } from '../../common/domain.errors';
import { COIN_TXN_TYPE } from '../coins/coins.constants';
import type { CoinsService } from '../coins/coins.service';

import { REWARD_BY_DAY } from './checkin.constants';

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

export type CheckinServiceDeps = {
  prisma: PrismaClient;
  coins: CoinsService;
};

export class CheckinService {
  private readonly prisma: PrismaClient;
  private readonly coins: CoinsService;

  constructor(deps: CheckinServiceDeps) {
    this.prisma = deps.prisma;
    this.coins = deps.coins;
  }

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
          throw DomainError.conflict('Already checked in today');
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

        const { balance: newBalance } = await this.coins.adjustBalance(
          userId,
          coinsAwarded,
          COIN_TXN_TYPE.DAILY_CHECKIN,
          null,
          tx,
        );

        return { streakCount, coinsAwarded, newBalance };
      });
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        throw DomainError.conflict('Already checked in today');
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

  // MVP: check-in day boundary is computed in UTC; see docs/tickets/10-checkin-progress.md.
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
