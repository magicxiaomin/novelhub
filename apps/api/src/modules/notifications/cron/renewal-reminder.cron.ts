import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../../auth/auth.constants';
import { NotificationsService } from '../notifications.service';
import { withCronLock } from './leader-election';

const RENEWAL_REMINDER_LOCK_KEY = 12002;

@Injectable()
export class RenewalReminderCron {
  private readonly logger = new Logger(RenewalReminderCron.name);

  constructor(
    private readonly notifications: NotificationsService,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  // See re-engagement.cron.ts: opt out of the in-process scheduler when
  // CRON_DRIVER=vercel (Phase 1). Local dev keeps the in-process scheduler.
  @Cron('0 9 * * *', { disabled: process.env.CRON_DRIVER === 'vercel' })
  async handle(): Promise<void> {
    try {
      await withCronLock(this.prisma, RENEWAL_REMINDER_LOCK_KEY, () =>
        this.notifications.sendRenewalReminders(),
      );
    } catch (err) {
      this.logger.warn(err instanceof Error ? err.message : 'Renewal reminder cron failed');
    }
  }
}
