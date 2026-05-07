import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PRISMA } from '../auth/auth.constants';
import { CACHE_CLIENT, type CacheClient } from '../cache/cache.constants';
import { BooksService } from '../books/books.service';
import { STORAGE_CLIENT, type StorageClient } from '../storage/storage.constants';

import type { CreateBookDto, UpdateBookDto } from './dto/book.dto';
import type { BulkChapterDto, BulkImportOptionsDto, UpdateChapterDto } from './dto/chapter.dto';
import type { AdminChapterListDto, AdminOrderListDto, AdminSearchDto } from './dto/query.dto';

const DEFAULT_DELIMITER = '\n\n---\n\n';
const MAX_CHAPTER_CONTENT_BYTES = 204800;
const ALLOWED_COVER_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
// The base coin package is $4.99 for 50 coins, which rounds to 10 cents/coin.
const COIN_REVENUE_CENTS = 10;

const wordCount = (text: string): number =>
  text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

const dayStart = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    @Inject(CACHE_CLIENT) private readonly cache: CacheClient,
    private readonly books: BooksService,
  ) {}

  async createBook(dto: CreateBookDto): Promise<{ id: string }> {
    const data: Prisma.BookCreateInput = {
      title: dto.title,
      author: dto.author,
      coverUrl: dto.coverUrl,
      coverImageKey: dto.coverImageKey,
      description: dto.description,
      category: dto.category,
      tags: dto.tags ?? [],
      status: dto.status ?? 'ONGOING',
      isFeatured: dto.isFeatured ?? false,
      freeChapterCount: dto.freeChapterCount ?? 3,
      coinPerChapter: dto.coinPerChapter ?? 5,
    };
    const book = await this.prisma.book.create({ data, select: { id: true } });
    await this.books.invalidateListCaches();
    return { id: book.id };
  }

  async listBooks(query: AdminSearchDto): Promise<{
    items: Array<{
      id: string;
      title: string;
      author: string;
      coverUrl: string;
      category: string;
      status: string;
      totalChapters: number;
      updatedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BookWhereInput = {
      deletedAt: null,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          author: true,
          coverUrl: true,
          category: true,
          status: true,
          totalChapters: true,
          updatedAt: true,
        },
      }),
      this.prisma.book.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getBook(id: string): Promise<{
    id: string;
    title: string;
    author: string;
    coverUrl: string;
    coverImageKey: string | null;
    description: string;
    category: string;
    tags: string[];
    status: string;
    isFeatured: boolean;
    freeChapterCount: number;
    coinPerChapter: number;
  }> {
    const book = await this.prisma.book.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        author: true,
        coverUrl: true,
        coverImageKey: true,
        description: true,
        category: true,
        tags: true,
        status: true,
        isFeatured: true,
        freeChapterCount: true,
        coinPerChapter: true,
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async updateBook(id: string, dto: UpdateBookDto): Promise<{ id: string }> {
    const book = await this.prisma.book.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    await this.prisma.book.update({ where: { id }, data: { ...dto } });
    await this.books.invalidateListCaches();
    return { id };
  }

  async softDeleteBook(id: string): Promise<{ id: string }> {
    const book = await this.prisma.book.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    await this.prisma.book.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.books.invalidateListCaches();
    return { id };
  }

  async bulkImportChapters(
    bookId: string,
    fileBuffer: Buffer,
    options: BulkImportOptionsDto,
  ): Promise<{ created: number }> {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, deletedAt: null },
      select: {
        id: true,
        freeChapterCount: true,
        totalChapters: true,
      },
    });
    if (!book) throw new NotFoundException('Book not found');

    const delimiter = options.delimiter ?? DEFAULT_DELIMITER;
    const text = fileBuffer.toString('utf-8');
    if (text.trim().length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const sections = text
      .split(delimiter)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (sections.length === 0) {
      throw new BadRequestException('No chapters parsed; check the delimiter and file format');
    }

    let baseOrder = book.totalChapters;
    if (options.replace) {
      // Soft-delete existing chapters by setting deletedAt; new chapters
      // will reuse `order` starting from 1.
      await this.prisma.chapter.updateMany({
        where: { bookId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      baseOrder = 0;
    }

    let created = 0;
    for (const [i, section] of sections.entries()) {
      const order = baseOrder + i + 1;
      const lines = section.split('\n');
      const firstLine = lines[0]?.trim() ?? '';
      const hasTitle = firstLine.length > 0 && firstLine.length < 120;
      const title = hasTitle ? firstLine : `Chapter ${order}`;
      const body = hasTitle ? lines.slice(1).join('\n').trim() : section;
      if (body.length === 0) continue;

      const isFree = order <= book.freeChapterCount;

      const chapter = await this.prisma.chapter.create({
        data: {
          bookId,
          order,
          title,
          contentUrl: '',
          wordCount: wordCount(body),
          isFree,
        },
        select: { id: true },
      });
      const key = `chapters/${bookId}/${chapter.id}.txt`;
      await this.storage.uploadText(key, body);
      await this.prisma.chapter.update({
        where: { id: chapter.id },
        data: { contentUrl: key },
      });
      // pre-warm the preview so the first read of a locked chapter is cheap
      await this.cache.set(`chapter:preview:${chapter.id}`, body.slice(0, 100));
      created += 1;
    }

    const newTotal = options.replace ? created : book.totalChapters + created;
    await this.prisma.book.update({
      where: { id: bookId },
      data: { totalChapters: newTotal },
    });
    await this.books.invalidateListCaches();
    return { created };
  }

  async bulkCreateChapters(
    bookId: string,
    chapters: BulkChapterDto[],
  ): Promise<{ created: number }> {
    if (chapters.length === 0) {
      throw new BadRequestException('At least one chapter is required');
    }
    const tooLarge = chapters.find(
      (chapter) => Buffer.byteLength(chapter.content, 'utf-8') > MAX_CHAPTER_CONTENT_BYTES,
    );
    if (tooLarge) {
      throw new BadRequestException(`Chapter content exceeds 200 KB: ${tooLarge.title}`);
    }
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, deletedAt: null },
      select: { id: true, freeChapterCount: true },
    });
    if (!book) throw new NotFoundException('Book not found');

    const uploads = await Promise.all(
      chapters.map(async (chapter) => {
        const key = `chapters/${bookId}/${randomUUID()}.txt`;
        await this.storage.uploadText(key, chapter.content);
        return { key, chapter };
      }),
    );

    let createdRows: Array<{ id: string; content: string }> = [];
    try {
      createdRows = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const max = await tx.chapter.aggregate({
          where: { bookId, deletedAt: null },
          _max: { order: true },
        });
        const baseOrder = max._max.order ?? 0;
        const rows: Array<{ id: string; content: string }> = [];
        for (const [index, upload] of uploads.entries()) {
          const order = baseOrder + index + 1;
          const row = await tx.chapter.create({
            data: {
              bookId,
              order,
              title: upload.chapter.title,
              contentUrl: upload.key,
              wordCount: wordCount(upload.chapter.content),
              isFree: upload.chapter.isFree ?? order <= book.freeChapterCount,
            },
            select: { id: true },
          });
          rows.push({ id: row.id, content: upload.chapter.content });
        }
        await tx.book.update({
          where: { id: bookId },
          data: { totalChapters: { increment: rows.length } },
        });
        return rows;
      });
    } catch (err) {
      this.logger.error(
        `bulkCreateChapters transaction failed after R2 upload; orphan keys: ${uploads
          .map((upload) => upload.key)
          .join(', ')}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }

    await Promise.all(
      createdRows.map((row) =>
        this.cache.set(`chapter:preview:${row.id}`, row.content.slice(0, 100)),
      ),
    );
    const created = createdRows.length;
    await this.books.invalidateListCaches();
    return { created };
  }

  async listChapters(query: AdminChapterListDto): Promise<{
    items: Array<{
      id: string;
      bookId: string;
      bookTitle: string;
      order: number;
      title: string;
      isFree: boolean;
      wordCount: number;
      updatedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ChapterWhereInput = {
      deletedAt: null,
      ...(query.bookId ? { bookId: query.bookId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.chapter.findMany({
        where,
        orderBy: [{ bookId: 'asc' }, { order: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          bookId: true,
          order: true,
          title: true,
          isFree: true,
          wordCount: true,
          updatedAt: true,
          book: { select: { title: true } },
        },
      }),
      this.prisma.chapter.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({ ...row, bookTitle: row.book.title })),
      total,
      page,
      limit,
    };
  }

  async getChapter(id: string): Promise<{
    id: string;
    bookId: string;
    order: number;
    title: string;
    isFree: boolean;
    content: string;
  }> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, bookId: true, order: true, title: true, isFree: true, contentUrl: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    const content = chapter.contentUrl ? await this.storage.getText(chapter.contentUrl) : '';
    return { ...chapter, content };
  }

  async updateChapter(id: string, dto: UpdateChapterDto): Promise<{ id: string }> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, bookId: true, contentUrl: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    const data: Prisma.ChapterUpdateInput = {};
    if (typeof dto.title === 'string') data.title = dto.title;
    if (typeof dto.isFree === 'boolean') data.isFree = dto.isFree;
    if (typeof dto.order === 'number') data.order = dto.order;

    if (typeof dto.content === 'string') {
      data.wordCount = wordCount(dto.content);
      const key = chapter.contentUrl || `chapters/${chapter.bookId}/${id}.txt`;
      await this.storage.uploadText(key, dto.content);
      data.contentUrl = key;
      await this.cache.set(`chapter:preview:${id}`, dto.content.slice(0, 100));
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.chapter.update({ where: { id }, data });
    }
    return { id };
  }

  async softDeleteChapter(id: string): Promise<{ id: string }> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, bookId: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    await this.prisma.chapter.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.cache.del(`chapter:preview:${id}`);
    return { id };
  }

  async dashboardSummary(): Promise<{
    today: {
      signups: number;
      payingUsers: number;
      revenueCents: number;
      estimatedRoasCents: number;
    };
    weekly: Array<{ date: string; signups: number; revenueCents: number }>;
    topBooks: Array<{ id: string; title: string; coverUrl?: string; revenueCents: number }>;
  }> {
    const todayStart = dayStart(new Date());
    const tomorrow = addDays(todayStart, 1);
    const weekStart = addDays(todayStart, -6);
    const completedOrderWhere: Prisma.OrderWhereInput = {
      status: 'completed',
      completedAt: { gte: todayStart, lt: tomorrow },
    };
    const topBooksStart = addDays(todayStart, -30);
    const [signups, payingUsers, revenue, weeklyUsers, weeklyOrders, unlockRows] =
      await Promise.all([
        this.prisma.user.count({ where: { createdAt: { gte: todayStart, lt: tomorrow } } }),
        this.prisma.order.findMany({
          where: completedOrderWhere,
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.order.aggregate({ where: completedOrderWhere, _sum: { amount: true } }),
        this.prisma.user.findMany({
          where: { createdAt: { gte: weekStart, lt: tomorrow } },
          select: { createdAt: true },
        }),
        this.prisma.order.findMany({
          where: { status: 'completed', completedAt: { gte: weekStart, lt: tomorrow } },
          select: { amount: true, completedAt: true },
        }),
        this.prisma.chapterUnlock.findMany({
          where: { method: 'COINS', unlockedAt: { gte: topBooksStart, lt: tomorrow } },
          select: {
            chapter: {
              select: {
                book: { select: { id: true, title: true, coverUrl: true, coinPerChapter: true } },
              },
            },
          },
        }),
      ]);

    const weekly = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index).toISOString().slice(0, 10);
      return { date, signups: 0, revenueCents: 0 };
    });
    const byDate = new Map(weekly.map((row) => [row.date, row]));
    for (const user of weeklyUsers) {
      const row = byDate.get(user.createdAt.toISOString().slice(0, 10));
      if (row) row.signups += 1;
    }
    for (const order of weeklyOrders) {
      if (!order.completedAt) continue;
      const row = byDate.get(order.completedAt.toISOString().slice(0, 10));
      if (row) row.revenueCents += order.amount;
    }
    const topBooksById = new Map<
      string,
      { id: string; title: string; coverUrl: string; coinTotal: number }
    >();
    for (const unlock of unlockRows) {
      const book = unlock.chapter.book;
      const existing = topBooksById.get(book.id);
      if (existing) {
        existing.coinTotal += book.coinPerChapter;
      } else {
        topBooksById.set(book.id, {
          id: book.id,
          title: book.title,
          coverUrl: book.coverUrl,
          coinTotal: book.coinPerChapter,
        });
      }
    }
    const topBooks = Array.from(topBooksById.values())
      .sort((a, b) => b.coinTotal - a.coinTotal)
      .slice(0, 5)
      .map(({ coinTotal, ...book }) => ({
        ...book,
        revenueCents: coinTotal * COIN_REVENUE_CENTS,
      }));

    return {
      today: {
        signups,
        payingUsers: payingUsers.length,
        revenueCents: revenue._sum.amount ?? 0,
        estimatedRoasCents: 0,
      },
      weekly,
      topBooks,
    };
  }

  async listUsers(query: AdminSearchDto): Promise<{
    items: Array<{
      id: string;
      email: string;
      coinBalance: number;
      isAdmin: boolean;
      bannedAt: Date | null;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search ? { email: { startsWith: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          coinBalance: true,
          isAdmin: true,
          bannedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getUser(id: string): Promise<{
    id: string;
    email: string;
    coinBalance: number;
    isAdmin: boolean;
    bannedAt: Date | null;
    createdAt: Date;
    purchases: { count: number; sumCents: number };
    unlocks: { count: number };
  }> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        coinBalance: true,
        isAdmin: true,
        bannedAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const [orders, unlocks] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: id, status: 'completed' },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.chapterUnlock.count({ where: { userId: id } }),
    ]);
    return {
      ...user,
      purchases: { count: orders._count.id, sumCents: orders._sum.amount ?? 0 },
      unlocks: { count: unlocks },
    };
  }

  async banUser(id: string): Promise<{ id: string }> {
    await this.prisma.user.update({ where: { id }, data: { bannedAt: new Date() } });
    return { id };
  }

  async unbanUser(id: string): Promise<{ id: string }> {
    await this.prisma.user.update({ where: { id }, data: { bannedAt: null } });
    return { id };
  }

  async listOrders(query: AdminOrderListDto): Promise<{
    items: Array<{
      id: string;
      userEmail: string;
      stripeSessionId: string;
      type: string;
      amount: number;
      currency: string;
      status: string;
      createdAt: Date;
      completedAt: Date | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { stripeSessionId: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          stripeSessionId: true,
          type: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          completedAt: true,
          user: { select: { email: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({ ...row, userEmail: row.user.email })),
      total,
      page,
      limit,
    };
  }

  async coverUploadUrl(contentType = 'image/jpeg'): Promise<{ uploadUrl: string; key: string }> {
    if (!ALLOWED_COVER_MIME.includes(contentType as (typeof ALLOWED_COVER_MIME)[number])) {
      throw new BadRequestException('Unsupported cover image type');
    }
    const key = `covers/${randomUUID()}`;
    const uploadUrl = await this.storage.getSignedUploadUrl(key, contentType);
    return { uploadUrl, key };
  }
}
