import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { NotificationsService } from '../notifications.service';

@Injectable()
export class ReEngagementCron {
  private readonly logger = new Logger(ReEngagementCron.name);

  constructor(private readonly notifications: NotificationsService) {}

  @Cron('0 */6 * * *')
  async handle(): Promise<void> {
    try {
      await this.notifications.sendReEngagement();
    } catch (err) {
      this.logger.warn(err instanceof Error ? err.message : 'Re-engagement cron failed');
    }
  }
}
