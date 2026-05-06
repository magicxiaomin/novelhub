import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';

import type { SaveProgressDto } from './dto/save-progress.dto';

export type ProgressResponse = {
  id: string;
  bookId: string;
  chapterId: string;
  scrollPercent: number;
  lastReadAt: Date;
};

export type ProgressListItem = {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  scrollPercent: number;
  bookTitle: string;
  bookCover: string;
  updatedAt: Date;
};

@Injectable()
export class ReadingProgressService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async save(userId: string, dto: SaveProgressDto): Promise<ProgressResponse> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: dto.chapterId },
      select: { id: true, bookId: true },
    });
    if (!chapter) throw new NotFoundException(`Chapter ${dto.chapterId} not found`);

    const scrollPosition = clampScrollPercent(dto.scrollPercent);
    const now = new Date();
    const progress = await this.prisma.readingProgress.upsert({
      where: { userId_chapterId: { userId, chapterId: dto.chapterId } },
      create: {
        userId,
        bookId: chapter.bookId,
        chapterId: dto.chapterId,
        scrollPosition,
        lastReadAt: now,
      },
      update: {
        bookId: chapter.bookId,
        scrollPosition,
        lastReadAt: now,
      },
      select: {
        id: true,
        bookId: true,
        chapterId: true,
        scrollPosition: true,
        lastReadAt: true,
      },
    });
    return toProgressResponse(progress);
  }

  async findOne(
    userId: string,
    query: { bookId?: string; chapterId?: string },
  ): Promise<ProgressResponse | null> {
    const progress = await this.prisma.readingProgress.findFirst({
      where: {
        userId,
        ...(query.bookId ? { bookId: query.bookId } : {}),
        ...(query.chapterId ? { chapterId: query.chapterId } : {}),
      },
      orderBy: { lastReadAt: 'desc' },
      select: {
        id: true,
        bookId: true,
        chapterId: true,
        scrollPosition: true,
        lastReadAt: true,
      },
    });
    return progress ? toProgressResponse(progress) : null;
  }

  async listRecent(userId: string, limit = 10): Promise<ProgressListItem[]> {
    const rows = await this.prisma.readingProgress.findMany({
      where: { userId },
      orderBy: { lastReadAt: 'desc' },
      take: limit,
      select: {
        bookId: true,
        chapterId: true,
        scrollPosition: true,
        updatedAt: true,
        chapter: { select: { order: true } },
        book: { select: { title: true, coverUrl: true } },
      },
    });
    return rows.map((row) => ({
      bookId: row.bookId,
      chapterId: row.chapterId,
      chapterNumber: row.chapter.order,
      scrollPercent: row.scrollPosition,
      bookTitle: row.book.title,
      bookCover: row.book.coverUrl,
      updatedAt: row.updatedAt,
    }));
  }
}

function clampScrollPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function toProgressResponse(progress: {
  id: string;
  bookId: string;
  chapterId: string;
  scrollPosition: number;
  lastReadAt: Date;
}): ProgressResponse {
  return {
    id: progress.id,
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    scrollPercent: progress.scrollPosition,
    lastReadAt: progress.lastReadAt,
  };
}
