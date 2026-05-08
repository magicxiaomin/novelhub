import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';
import { CoinsService } from '../coins/coins.service';

import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

@Module({
  imports: [AuthModule, CoinsModule],
  controllers: [CheckinController],
  providers: [
    {
      provide: CheckinService,
      useFactory: (prisma: PrismaClient, coins: CoinsService): CheckinService =>
        new CheckinService({ prisma, coins }),
      inject: [PRISMA, CoinsService],
    },
  ],
  exports: [CheckinService],
})
export class CheckinModule {}
