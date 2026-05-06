import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { CoinsController } from './coins.controller';
import { CoinsService } from './coins.service';

@Module({
  imports: [AuthModule],
  controllers: [CoinsController],
  providers: [CoinsService],
  exports: [CoinsService],
})
export class CoinsModule {}
