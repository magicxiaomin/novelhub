import { ApiProperty } from '@nestjs/swagger';

/**
 * Single row of the Continue-Reading rail returned by `GET /reading-progress`
 * when no bookId/chapterId is provided.
 */
export class ProgressListItemDto {
  @ApiProperty({ format: 'uuid' })
  bookId!: string;

  @ApiProperty({ format: 'uuid' })
  chapterId!: string;

  @ApiProperty()
  chapterNumber!: number;

  @ApiProperty()
  scrollPercent!: number;

  @ApiProperty()
  bookTitle!: string;

  @ApiProperty()
  bookCover!: string;

  @ApiProperty()
  updatedAt!: Date;
}
