import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { CoinsModule } from '../coins/coins.module';

import { ReEngagementCron } from './cron/re-engagement.cron';
import { RenewalReminderCron } from './cron/renewal-reminder.cron';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OneSignalClient } from './one-signal.client';

@Module({
  imports: [AdminModule, CoinsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, OneSignalClient, ReEngagementCron, RenewalReminderCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
