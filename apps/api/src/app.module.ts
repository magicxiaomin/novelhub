import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BooksModule } from './modules/books/books.module';
import { CacheModule } from './modules/cache/cache.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { CoinsModule } from './modules/coins/coins.module';
import { FbCapiModule } from './modules/fb-capi/fb-capi.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReadingProgressModule } from './modules/reading-progress/reading-progress.module';
import { StorageModule } from './modules/storage/storage.module';
import { UnlocksModule } from './modules/unlocks/unlocks.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        limit: 60,
        ttl: 60000,
      },
    ]),
    ScheduleModule.forRoot(),
    StorageModule,
    CacheModule,
    AuthModule,
    BooksModule,
    ChaptersModule,
    CoinsModule,
    UnlocksModule,
    ReadingProgressModule,
    CheckinModule,
    FbCapiModule,
    PaymentsModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
