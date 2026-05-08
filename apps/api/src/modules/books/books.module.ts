import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { AuthModule } from '../auth/auth.module';
import { PRISMA } from '../auth/auth.constants';
import { CACHE_CLIENT, type CacheClient } from '../cache/cache.constants';

import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [AuthModule],
  controllers: [BooksController],
  providers: [
    {
      provide: BooksService,
      useFactory: (prisma: PrismaClient, cache: CacheClient): BooksService =>
        new BooksService({ prisma, cache }),
      inject: [PRISMA, CACHE_CLIENT],
    },
  ],
  exports: [BooksService],
})
export class BooksModule {}
