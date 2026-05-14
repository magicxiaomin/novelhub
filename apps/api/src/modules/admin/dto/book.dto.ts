import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  MinLength,
} from 'class-validator';

import type { CreateBookDto as CreateBookType } from './book.types';

const BOOK_STATUSES = ['ONGOING', 'COMPLETED'] as const;

export class CreateBookDto implements CreateBookType {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  author!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  coverUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageKey?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  description!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  category!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: BOOK_STATUSES, default: 'ONGOING' })
  @IsOptional()
  @IsIn([...BOOK_STATUSES])
  status?: (typeof BOOK_STATUSES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  freeChapterCount?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  coinPerChapter?: number;
}

export class UpdateBookDto extends PartialType(CreateBookDto) {}
