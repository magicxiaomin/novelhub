import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { BOOK_LIST_TTL_SECONDS, CACHE_CLIENT, type CacheClient } from '../cache/cache.constants';

import type {
  BookDetail,
  BookSummary,
  CategoryCount,
  ChapterSummary,
  Paginated,
} from './books.types';
import type { ListBooksDto, ListChaptersDto, SearchBooksDto } from './dto/list-books.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_CHAPTER_PAGE_SIZE = 50;
const TRENDING_LIMIT = 20;
const FEATURED_LIMIT = 10;
const DETAIL_CHAPTER_PREVIEW = 10;

const toBookSummary = (book: {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  category: string;
  tags: string[];
  status: string;
  isFeatured: boolean;
  totalChapters: number;
  freeChapterCount: number;
  coinPerChapter: number;
}): BookSummary => ({
  id: book.id,
  title: book.title,
  author: book.author,
  coverUrl: book.coverUrl,
  category: book.category,
  tags: book.tags,
  status: book.status,
  isFeatured: book.isFeatured,
  totalChapters: book.totalChapters,
  freeChapterCount: book.freeChapterCount,
  coinPerChapter: book.coinPerChapter,
});

const toChapterSummary = (chapter: {
  id: string;
  bookId: string;
  order: number;
  title: string;
  isFree: boolean;
  wordCount: number;
}): ChapterSummary => ({
  id: chapter.id,
  bookId: chapter.bookId,
  order: chapter.order,
  title: chapter.title,
  isFree: chapter.isFree,
  wordCount: chapter.wordCount,
});

@Injectable()
export class BooksService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CACHE_CLIENT) private readonly cache: CacheClient,
  ) {}

  async list(query: ListBooksDto): Promise<Paginated<BookSummary>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const cacheKey = `books:list:${query.category ?? '*'}:${query.status ?? '*'}:${query.featured ?? '*'}:${page}:${limit}`;
    const cached = await this.cache.get<Paginated<BookSummary>>(cacheKey);
    if (cached) return cached;

    const where: Prisma.BookWhereInput = { deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (typeof query.featured === 'boolean') where.isFeatured = query.featured;

    const [items, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.book.count({ where }),
    ]);

    const result: Paginated<BookSummary> = {
      items: items.map(toBookSummary),
      total,
      page,
      limit,
    };
    await this.cache.set(cacheKey, result, BOOK_LIST_TTL_SECONDS);
    return result;
  }

  async featured(): Promise<BookSummary[]> {
    const cacheKey = 'books:featured';
    const cached = await this.cache.get<BookSummary[]>(cacheKey);
    if (cached) return cached;

    const books = await this.prisma.book.findMany({
      where: { deletedAt: null, isFeatured: true },
      orderBy: { createdAt: 'desc' },
      take: FEATURED_LIMIT,
    });
    const result = books.map(toBookSummary);
    await this.cache.set(cacheKey, result, BOOK_LIST_TTL_SECONDS);
    return result;
  }

  async trending(): Promise<BookSummary[]> {
    const cacheKey = 'books:trending';
    const cached = await this.cache.get<BookSummary[]>(cacheKey);
    if (cached) return cached;

    const books = await this.prisma.book.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: TRENDING_LIMIT,
    });
    const result = books.map(toBookSummary);
    await this.cache.set(cacheKey, result, BOOK_LIST_TTL_SECONDS);
    return result;
  }

  async categories(): Promise<CategoryCount[]> {
    const cacheKey = 'books:categories';
    const cached = await this.cache.get<CategoryCount[]>(cacheKey);
    if (cached) return cached;

    const groups = await this.prisma.book.groupBy({
      by: ['category'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const result = groups
      .map((g) => ({
        category: g.category,
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
    await this.cache.set(cacheKey, result, BOOK_LIST_TTL_SECONDS);
    return result;
  }

  async search(query: SearchBooksDto): Promise<Paginated<BookSummary>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const term = (query.q ?? '').trim();
    if (!term) {
      return { items: [], total: 0, page, limit };
    }
    const where: Prisma.BookWhereInput = {
      deletedAt: null,
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { author: { contains: term, mode: 'insensitive' } },
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.book.count({ where }),
    ]);
    return {
      items: items.map(toBookSummary),
      total,
      page,
      limit,
    };
  }

  async getById(id: string): Promise<BookDetail> {
    const book = await this.prisma.book.findFirst({
      where: { id, deletedAt: null },
      include: {
        chapters: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          take: DETAIL_CHAPTER_PREVIEW,
        },
      },
    });
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    const summary = toBookSummary(book);
    return {
      ...summary,
      description: book.description,
      chapters: book.chapters.map(toChapterSummary),
    };
  }

  async listChapters(bookId: string, query: ListChaptersDto): Promise<Paginated<ChapterSummary>> {
    const exists = await this.prisma.book.findFirst({
      where: { id: bookId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Book not found');
    }
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_CHAPTER_PAGE_SIZE;
    const where: Prisma.ChapterWhereInput = { bookId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.chapter.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chapter.count({ where }),
    ]);
    return {
      items: items.map(toChapterSummary),
      total,
      page,
      limit,
    };
  }

  /**
   * Invalidates all cached book list responses. Called by admin writes.
   * The naming scheme `books:list:*` and `books:{featured,trending,categories}`
   * is keyed deterministically so we can issue a small fixed set of dels.
   */
  async invalidateListCaches(): Promise<void> {
    await Promise.all([
      this.cache.del('books:featured'),
      this.cache.del('books:trending'),
      this.cache.del('books:categories'),
    ]);
  }
}
