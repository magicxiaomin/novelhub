import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { ReadingProgressController } from './reading-progress.controller';
import { ReadingProgressService } from './reading-progress.service';

@Module({
  imports: [AuthModule],
  controllers: [ReadingProgressController],
  providers: [ReadingProgressService],
  exports: [ReadingProgressService],
})
export class ReadingProgressModule {}
