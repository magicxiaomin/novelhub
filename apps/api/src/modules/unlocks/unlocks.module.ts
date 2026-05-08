import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';
import { CoinsService } from '../coins/coins.service';

import { UnlocksController } from './unlocks.controller';
import { UnlocksService } from './unlocks.service';

@Module({
  imports: [AuthModule, CoinsModule],
  controllers: [UnlocksController],
  providers: [
    {
      provide: UnlocksService,
      useFactory: (prisma: PrismaClient, coins: CoinsService): UnlocksService =>
        new UnlocksService({ prisma, coins }),
      inject: [PRISMA, CoinsService],
    },
  ],
  exports: [UnlocksService],
})
export class UnlocksModule {}
