import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsUUID, Min } from 'class-validator';

export class SaveProgressDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  bookId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  chapterId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapterNumber!: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  scrollPercent!: number;
}
