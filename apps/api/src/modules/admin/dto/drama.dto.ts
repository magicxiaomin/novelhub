import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import type {
  CreateDramaDto as CreateDramaType,
  CreateEpisodeDto as CreateEpisodeType,
  UpsertEpisodeVideoDto as UpsertEpisodeVideoType,
} from './drama.types';

const DRAMA_STATUSES = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED'] as const;
const DRAMA_PROVIDERS = ['external_hls'] as const;

export class UpsertEpisodeVideoDto implements UpsertEpisodeVideoType {
  @ApiProperty({ enum: DRAMA_PROVIDERS })
  @IsIn([...DRAMA_PROVIDERS])
  provider!: 'external_hls';

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  playbackUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateDramaDto implements CreateDramaType {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  description!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  posterUrl!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  category!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: DRAMA_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsIn([...DRAMA_STATUSES])
  status?: (typeof DRAMA_STATUSES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  freeEpisodeCount?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  coinPerEpisode?: number;
}

export class UpdateDramaDto extends PartialType(CreateDramaDto) {}

export class CreateEpisodeDto implements CreateEpisodeType {
  @ApiProperty()
  @IsUUID('4')
  dramaId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  episodeNumber!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ type: UpsertEpisodeVideoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertEpisodeVideoDto)
  video?: UpsertEpisodeVideoDto;
}

export class UpdateEpisodeDto extends PartialType(
  OmitType(CreateEpisodeDto, ['dramaId'] as const),
) {}
