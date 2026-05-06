import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class SaveProgressDto {
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
