import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { NotificationsService } from '../notifications.service';

@Injectable()
export class RenewalReminderCron {
  private readonly logger = new Logger(RenewalReminderCron.name);

  constructor(private readonly notifications: NotificationsService) {}

  @Cron('0 9 * * *')
  async handle(): Promise<void> {
    try {
      await this.notifications.sendRenewalReminders();
    } catch (err) {
      this.logger.warn(err instanceof Error ? err.message : 'Renewal reminder cron failed');
    }
  }
}
