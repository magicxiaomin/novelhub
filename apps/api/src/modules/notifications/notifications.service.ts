import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { COIN_TXN_TYPE } from '../coins/coins.constants';
import { CoinsService } from '../coins/coins.service';

import { ONESIGNAL_DEFAULT_SEGMENT, PUSH_PERMISSION_REWARD_COINS } from './notifications.constants';
import { OneSignalClient } from './one-signal.client';

export type GrantBonusResult =
  | { granted: true; balance: number }
  | { granted: false; reason: 'already_granted' };

export type ReEngagementTarget = {
  userId: string;
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
};

export type RenewalTarget = {
  userId: string;
};

type ProgressRow = {
  userId: string | null;
  lastReadAt: Date;
  book: { id: string; title: string };
  chapter: { order: number };
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly coins: CoinsService,
    private readonly oneSignal: OneSignalClient,
  ) {}

  async grantBonus(userId: string): Promise<GrantBonusResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.coinTransaction.findFirst({
        where: { userId, type: COIN_TXN_TYPE.PUSH_REWARD },
        select: { id: true },
      });
      if (existing) return { granted: false, reason: 'already_granted' };

      const { balance } = await this.coins.adjustBalance(
        userId,
        PUSH_PERMISSION_REWARD_COINS,
        COIN_TXN_TYPE.PUSH_REWARD,
        null,
        tx,
      );
      return { granted: true, balance };
    });
  }

  async broadcast(input: {
    title: string;
    body: string;
    url?: string;
    segmentName?: string;
  }): Promise<{ sent: boolean; id?: string }> {
    return this.oneSignal.sendNotification({
      title: input.title,
      body: input.body,
      url: input.url,
      segments: [input.segmentName ?? ONESIGNAL_DEFAULT_SEGMENT],
    });
  }

  async findUsersForReEngagement(now = new Date()): Promise<ReEngagementTarget[]> {
    const lower = new Date(now.getTime() - 28 * 60 * 60 * 1000);
    const upper = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows: ProgressRow[] = await this.prisma.readingProgress.findMany({
      where: {
        userId: { not: null },
        lastReadAt: { gte: lower, lte: upper },
      },
      orderBy: { lastReadAt: 'desc' },
      select: {
        userId: true,
        lastReadAt: true,
        book: { select: { id: true, title: true } },
        chapter: { select: { order: true } },
      },
    });

    const targets: ReEngagementTarget[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.userId || seen.has(row.userId)) continue;
      seen.add(row.userId);
      const newer = await this.prisma.readingProgress.findFirst({
        where: { userId: row.userId, lastReadAt: { gt: row.lastReadAt } },
        select: { id: true },
      });
      if (newer) continue;
      targets.push({
        userId: row.userId,
        bookId: row.book.id,
        bookTitle: row.book.title,
        chapterNumber: row.chapter.order,
      });
    }
    return targets;
  }

  async sendReEngagement(now = new Date()): Promise<void> {
    const targets = await this.findUsersForReEngagement(now);
    for (const target of targets) {
      const res = await this.oneSignal.sendNotification({
        title: `Continue reading ${target.bookTitle}`,
        body: 'Your next chapter is waiting.',
        url: `/read/${target.bookId}/${target.chapterNumber}`,
        includeExternalUserIds: [target.userId],
      });
      this.logger.log(`Re-engagement push attempted for ${target.userId}: ${res.sent}`);
    }
  }

  async findUsersForRenewal(now = new Date()): Promise<RenewalTarget[]> {
    const lower = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const upper = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.subscription.findMany({
      where: {
        currentPeriodEnd: { gte: lower, lte: upper },
        cancelAtPeriodEnd: false,
      },
      select: { userId: true },
    });
    return rows.map((row) => ({ userId: row.userId }));
  }

  async sendRenewalReminders(now = new Date()): Promise<void> {
    const targets = await this.findUsersForRenewal(now);
    for (const target of targets) {
      const res = await this.oneSignal.sendNotification({
        title: 'Your subscription renews in 3 days. Manage in Settings.',
        body: 'Review your plan before renewal.',
        url: '/me',
        includeExternalUserIds: [target.userId],
      });
      this.logger.log(`Renewal push attempted for ${target.userId}: ${res.sent}`);
    }
  }
}
