import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { AuthModule } from '../auth/auth.module';
import { PRISMA } from '../auth/auth.constants';
import { CACHE_CLIENT, type CacheClient } from '../cache/cache.constants';
import { STORAGE_CLIENT, type StorageClient } from '../storage/storage.constants';

import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';

@Module({
  imports: [AuthModule],
  controllers: [ChaptersController],
  providers: [
    {
      provide: ChaptersService,
      useFactory: (
        prisma: PrismaClient,
        storage: StorageClient,
        cache: CacheClient,
      ): ChaptersService => new ChaptersService({ prisma, storage, cache }),
      inject: [PRISMA, STORAGE_CLIENT, CACHE_CLIENT],
    },
  ],
  exports: [ChaptersService],
})
export class ChaptersModule {}
