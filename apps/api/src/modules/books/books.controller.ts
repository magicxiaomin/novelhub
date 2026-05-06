import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  BookDetail,
  BookSummary,
  CategoryCount,
  ChapterSummary,
  Paginated,
} from './books.types';
import { BooksService } from './books.service';
import { ListBooksDto, ListChaptersDto, SearchBooksDto } from './dto/list-books.dto';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'List books with optional filters' })
  @ApiOkResponse({ description: 'Paginated book summaries' })
  list(@Query() query: ListBooksDto): Promise<Paginated<BookSummary>> {
    return this.books.list(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Featured books for homepage banner' })
  featured(): Promise<BookSummary[]> {
    return this.books.featured();
  }

  @Get('trending')
  @ApiOperation({ summary: 'Trending books (most recent for MVP)' })
  trending(): Promise<BookSummary[]> {
    return this.books.trending();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Categories with book counts' })
  categories(): Promise<CategoryCount[]> {
    return this.books.categories();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search books by title or author' })
  search(@Query() query: SearchBooksDto): Promise<Paginated<BookSummary>> {
    return this.books.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Book detail with the first 10 chapters' })
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<BookDetail> {
    return this.books.getById(id);
  }

  @Get(':id/chapters')
  @ApiOperation({ summary: 'Paginated chapter list for a book' })
  chapters(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ListChaptersDto,
  ): Promise<Paginated<ChapterSummary>> {
    return this.books.listChapters(id, query);
  }
}
