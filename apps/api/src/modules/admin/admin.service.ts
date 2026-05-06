import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { CACHE_CLIENT, type CacheClient } from '../cache/cache.constants';
import { BooksService } from '../books/books.service';
import { STORAGE_CLIENT, type StorageClient } from '../storage/storage.constants';

import type { CreateBookDto, UpdateBookDto } from './dto/book.dto';
import type { BulkImportOptionsDto, UpdateChapterDto } from './dto/chapter.dto';

const DEFAULT_DELIMITER = '\n\n---\n\n';

const wordCount = (text: string): number =>
  text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

@Injectable()
export class AdminService {
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
}
