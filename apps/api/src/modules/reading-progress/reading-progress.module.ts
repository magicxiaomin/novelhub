import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';

import { ReadingProgressController } from './reading-progress.controller';
import { ReadingProgressService } from './reading-progress.service';

@Module({
  imports: [AuthModule],
  controllers: [ReadingProgressController],
  providers: [
    {
      provide: ReadingProgressService,
      useFactory: (prisma: PrismaClient): ReadingProgressService =>
        new ReadingProgressService({ prisma }),
      inject: [PRISMA],
    },
  ],
  exports: [ReadingProgressService],
})
export class ReadingProgressModule {}
