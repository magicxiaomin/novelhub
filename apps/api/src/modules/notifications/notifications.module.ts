import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { AdminModule } from '../admin/admin.module';
import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';
import { CoinsService } from '../coins/coins.service';

import { ReEngagementCron } from './cron/re-engagement.cron';
import { RenewalReminderCron } from './cron/renewal-reminder.cron';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OneSignalClient } from './one-signal.client';

@Module({
  imports: [AuthModule, AdminModule, CoinsModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: OneSignalClient,
      useFactory: (): OneSignalClient =>
        new OneSignalClient({
          apiKey: process.env.ONESIGNAL_REST_API_KEY,
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        }),
    },
    {
      provide: NotificationsService,
      useFactory: (
        prisma: PrismaClient,
        coins: CoinsService,
        oneSignal: OneSignalClient,
      ): NotificationsService => new NotificationsService({ prisma, coins, oneSignal }),
      inject: [PRISMA, CoinsService, OneSignalClient],
    },
    ReEngagementCron,
    RenewalReminderCron,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
