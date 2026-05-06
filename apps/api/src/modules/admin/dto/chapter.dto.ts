import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateChapterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ description: 'Replacement chapter content (plain text)' })
  @IsOptional()
  @IsString()
  content?: string;
}

export class BulkImportOptionsDto {
  @ApiProperty({
    default: '\n\n---\n\n',
    description: 'Delimiter that splits the upload into chapters',
  })
  @IsOptional()
  @IsString()
  delimiter?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'If true, replace existing chapters for this book',
  })
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}
