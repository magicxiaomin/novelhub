import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../../auth/auth.constants';
import { NotificationsService } from '../notifications.service';
import { withCronLock } from './leader-election';

const RE_ENGAGEMENT_LOCK_KEY = 12001;

@Injectable()
export class ReEngagementCron {
  private readonly logger = new Logger(ReEngagementCron.name);

  constructor(
    private readonly notifications: NotificationsService,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  @Cron('0 */6 * * *')
  async handle(): Promise<void> {
    try {
      await withCronLock(this.prisma, RE_ENGAGEMENT_LOCK_KEY, () =>
        this.notifications.sendReEngagement(),
      );
    } catch (err) {
      this.logger.warn(err instanceof Error ? err.message : 'Re-engagement cron failed');
    }
  }
}
