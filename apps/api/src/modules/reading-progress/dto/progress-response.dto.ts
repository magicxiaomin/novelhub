import { ApiProperty } from '@nestjs/swagger';

export class ProgressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  bookId!: string;

  @ApiProperty({ format: 'uuid' })
  chapterId!: string;

  @ApiProperty()
  scrollPercent!: number;

  @ApiProperty()
  lastReadAt!: Date;
}
