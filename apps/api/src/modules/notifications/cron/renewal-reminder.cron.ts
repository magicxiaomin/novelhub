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

  @Cron('0 9 * * *')
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
