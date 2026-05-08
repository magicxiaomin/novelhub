import {
  ReadingProgressService,
  type ReadingProgressServiceDeps,
} from './reading-progress.service';

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

type FakeChapter = {
  id: string;
  bookId: string;
  isFree: boolean;
};

type FakeUnlock = { userId: string; chapterId: string };
type FakeSubscription = { userId: string; status: string; currentPeriodEnd: Date };

type StubState = {
  progress: FakeProgress[];
  chapters: FakeChapter[];
  unlocks?: FakeUnlock[];
  subscriptions?: FakeSubscription[];
};

const buildPrismaStub = (state: StubState) => {
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

  const chapterClient = {
    findFirst: async ({ where }: { where: { id: string; deletedAt?: unknown; book?: unknown } }) =>
      state.chapters.find((chapter) => chapter.id === where.id) ?? null,
  };

  const chapterUnlockClient = {
    findUnique: async ({
      where,
    }: {
      where: { userId_chapterId: { userId: string; chapterId: string } };
    }) =>
      state.unlocks?.find(
        (u) =>
          u.userId === where.userId_chapterId.userId &&
          u.chapterId === where.userId_chapterId.chapterId,
      ) ?? null,
  };

  const subscriptionClient = {
    findFirst: async ({ where }: { where: { userId: string } }) =>
      state.subscriptions?.find((s) => s.userId === where.userId) ?? null,
  };

  return {
    chapter: chapterClient,
    chapterUnlock: chapterUnlockClient,
    subscription: subscriptionClient,
    readingProgress: readingProgressClient,
  };
};

describe('ReadingProgressService', () => {
  const buildService = (
    state: StubState,
  ): { service: ReadingProgressService; state: StubState } => {
    const deps = {
      prisma: buildPrismaStub(state),
    } as unknown as ReadingProgressServiceDeps;
    return { service: new ReadingProgressService(deps), state };
  };

  it('upserts progress for the current user and clamps scrollPercent', async () => {
    const { service, state } = buildService({
      progress: [],
      chapters: [{ id: 'chapter-1', bookId: 'book-1', isFree: true }],
    });

    const created = await service.save('user-1', {
      chapterId: 'chapter-1',
      scrollPercent: 150,
    });
    const updated = await service.save('user-1', {
      chapterId: 'chapter-1',
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

  it('rejects save() when the chapter is locked and the user has no unlock or subscription', async () => {
    const { service } = buildService({
      progress: [],
      chapters: [{ id: 'chapter-locked', bookId: 'book-1', isFree: false }],
    });

    await expect(
      service.save('user-1', { chapterId: 'chapter-locked', scrollPercent: 25 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('accepts save() for a locked chapter when the user owns an unlock', async () => {
    const { service, state } = buildService({
      progress: [],
      chapters: [{ id: 'chapter-locked', bookId: 'book-1', isFree: false }],
      unlocks: [{ userId: 'user-1', chapterId: 'chapter-locked' }],
    });

    await service.save('user-1', { chapterId: 'chapter-locked', scrollPercent: 25 });
    expect(state.progress).toHaveLength(1);
  });

  it('accepts save() for a locked chapter when the user has an active subscription', async () => {
    const { service, state } = buildService({
      progress: [],
      chapters: [{ id: 'chapter-locked', bookId: 'book-1', isFree: false }],
      subscriptions: [
        {
          userId: 'user-1',
          status: 'active',
          currentPeriodEnd: new Date('2030-01-01T00:00:00.000Z'),
        },
      ],
    });

    await service.save('user-1', { chapterId: 'chapter-locked', scrollPercent: 25 });
    expect(state.progress).toHaveLength(1);
  });

  it('rejects save() for a chapter that does not exist (matches the no-access response)', async () => {
    const { service } = buildService({
      progress: [],
      chapters: [],
    });

    await expect(
      service.save('user-1', {
        chapterId: '11111111-1111-4111-8111-111111111111',
        scrollPercent: 25,
      }),
    ).rejects.toMatchObject({ status: 404 });
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
    const { service } = buildService({ progress, chapters: [] });

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
