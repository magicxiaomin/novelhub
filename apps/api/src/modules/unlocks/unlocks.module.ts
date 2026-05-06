import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';

import { UnlocksController } from './unlocks.controller';
import { UnlocksService } from './unlocks.service';

@Module({
  imports: [AuthModule, CoinsModule],
  controllers: [UnlocksController],
  providers: [UnlocksService],
  exports: [UnlocksService],
})
export class UnlocksModule {}
