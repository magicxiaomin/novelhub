import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';
import { BooksService } from '../books/books.service';
import { CACHE_CLIENT, type CacheClient } from '../cache/cache.constants';
import { STORAGE_CLIENT, type StorageClient } from '../storage/storage.constants';

import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, BooksModule],
  controllers: [AdminController],
  providers: [
    AdminGuard,
    {
      provide: AdminService,
      useFactory: (
        prisma: PrismaClient,
        storage: StorageClient,
        cache: CacheClient,
        books: BooksService,
      ): AdminService =>
        new AdminService({
          prisma,
          storage,
          cache,
          books,
          publicR2Host: process.env.R2_PUBLIC_HOST ?? process.env.NEXT_PUBLIC_R2_PUBLIC_HOST,
          hlsAllowedHosts: process.env.HLS_ALLOWED_HOSTS,
          nodeEnv: process.env.NODE_ENV,
        }),
      inject: [PRISMA, STORAGE_CLIENT, CACHE_CLIENT, BooksService],
    },
  ],
  exports: [AdminGuard],
})
export class AdminModule {}
