import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';

import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

@Module({
  imports: [AuthModule, CoinsModule],
  controllers: [CheckinController],
  providers: [CheckinService],
  exports: [CheckinService],
})
export class CheckinModule {}
