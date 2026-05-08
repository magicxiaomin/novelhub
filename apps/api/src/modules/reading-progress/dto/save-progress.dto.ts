import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

import type { SaveProgressDto as SaveProgressType } from './save-progress.types';

export class SaveProgressDto implements SaveProgressType {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  chapterId!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  scrollPercent!: number;
}
