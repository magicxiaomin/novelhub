import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AdminPaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminSearchDto extends AdminPaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminChapterListDto extends AdminPaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  bookId?: string;
}

export class AdminOrderListDto extends AdminSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['pending', 'completed', 'failed', 'refunded'])
  status?: string;
}

export class CoverUploadUrlDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentType?: string;
}
