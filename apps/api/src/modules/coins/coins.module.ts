import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';

import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';

@Module({
  imports: [AuthModule],
  controllers: [CoinsController],
  providers: [
    {
      provide: CoinsService,
      useFactory: (prisma: PrismaClient): CoinsService => new CoinsService({ prisma }),
      inject: [PRISMA],
    },
  ],
  exports: [CoinsService],
})
export class CoinsModule {}
