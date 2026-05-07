import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class BroadcastDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;

  @ApiPropertyOptional({ format: 'uri' })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({ default: 'All' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  segmentName?: string;
}
