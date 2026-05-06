import { Test, type TestingModule } from '@nestjs/testing';

import { PRISMA } from '../auth/auth.constants';

import { ReadingProgressService } from './reading-progress.service';

type FakeProgress = {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  scrollPosition: number;
  lastReadAt: Date;
  updatedAt: Date;
  chapter: { order: number };
  book: { title: string; coverUrl: string };
};

const buildPrismaStub = (state: { progress: FakeProgress[] }) => {
  let progressCounter = 0;

  const readingProgressClient = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId_chapterId: { userId: string; chapterId: string } };
      create: {
        userId: string;
        bookId: string;
        chapterId: string;
        scrollPosition: number;
        lastReadAt: Date;
      };
      update: { bookId: string; scrollPosition: number; lastReadAt: Date };
    }) => {
      const existing = state.progress.find(
        (row) =>
          row.userId === where.userId_chapterId.userId &&
          row.chapterId === where.userId_chapterId.chapterId,
      );
      if (existing) {
        existing.bookId = update.bookId;
        existing.scrollPosition = update.scrollPosition;
        existing.lastReadAt = update.lastReadAt;
        existing.updatedAt = update.lastReadAt;
        return existing;
      }

      progressCounter += 1;
      const created: FakeProgress = {
        id: `progress-${progressCounter}`,
        ...create,
        updatedAt: create.lastReadAt,
        chapter: { order: 12 },
        book: { title: 'The Test Book', coverUrl: 'https://cdn.example.test/cover.jpg' },
      };
      state.progress.push(created);
      return created;
    },
    findFirst: async ({
      where,
    }: {
      where: { userId: string; bookId?: string; chapterId?: string };
    }) =>
      state.progress.find(
        (row) =>
          row.userId === where.userId &&
          (!where.bookId || row.bookId === where.bookId) &&
          (!where.chapterId || row.chapterId === where.chapterId),
      ) ?? null,
    findMany: async ({ where, take }: { where: { userId: string }; take: number }) =>
      state.progress
        .filter((row) => row.userId === where.userId)
        .sort((a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime())
        .slice(0, take),
  };

  return { readingProgress: readingProgressClient };
};

describe('ReadingProgressService', () => {
  const buildService = async (state: {
    progress: FakeProgress[];
  }): Promise<{ service: ReadingProgressService; state: typeof state }> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReadingProgressService, { provide: PRISMA, useValue: buildPrismaStub(state) }],
    }).compile();
    return { service: module.get(ReadingProgressService), state };
  };

  it('upserts progress for the current user and clamps scrollPercent', async () => {
    const { service, state } = await buildService({ progress: [] });

    const created = await service.save('user-1', {
      bookId: 'book-1',
      chapterId: 'chapter-1',
      chapterNumber: 12,
      scrollPercent: 150,
    });
    const updated = await service.save('user-1', {
      bookId: 'book-1',
      chapterId: 'chapter-1',
      chapterNumber: 12,
      scrollPercent: 48,
    });

    expect(state.progress).toHaveLength(1);
    expect(created.scrollPercent).toBe(100);
    expect(updated).toMatchObject({
      id: created.id,
      bookId: 'book-1',
      chapterId: 'chapter-1',
      scrollPercent: 48,
    });
  });

  it('empty args list path returns the 10 most recent Continue Reading entries', async () => {
    const now = new Date('2026-05-06T00:00:00.000Z');
    const progress = Array.from({ length: 12 }, (_, index): FakeProgress => {
      const n = index + 1;
      return {
        id: `progress-${n}`,
        userId: 'user-1',
        bookId: `book-${n}`,
        chapterId: `chapter-${n}`,
        scrollPosition: n,
        lastReadAt: new Date(now.getTime() + n * 1000),
        updatedAt: new Date(now.getTime() + n * 1000),
        chapter: { order: n },
        book: { title: `Book ${n}`, coverUrl: `https://cdn.example.test/${n}.jpg` },
      };
    });
    const { service } = await buildService({ progress });

    const recent = await service.listRecent('user-1');

    expect(recent).toHaveLength(10);
    expect(recent[0]).toMatchObject({
      bookId: 'book-12',
      chapterId: 'chapter-12',
      chapterNumber: 12,
      scrollPercent: 12,
      bookTitle: 'Book 12',
      bookCover: 'https://cdn.example.test/12.jpg',
    });
    expect(recent.at(-1)?.bookId).toBe('book-3');
  });
});
