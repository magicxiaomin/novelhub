import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BooksModule } from './modules/books/books.module';
import { CacheModule } from './modules/cache/cache.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { CoinsModule } from './modules/coins/coins.module';
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
    StorageModule,
    CacheModule,
    AuthModule,
    BooksModule,
    ChaptersModule,
    CoinsModule,
    UnlocksModule,
    ReadingProgressModule,
    PaymentsModule,
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
