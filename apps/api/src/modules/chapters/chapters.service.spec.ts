import { ChaptersService, type ChaptersServiceDeps } from './chapters.service';

type FakeChapter = {
  id: string;
  bookId: string;
  order: number;
  title: string;
  contentUrl: string;
  wordCount: number;
  isFree: boolean;
  deletedAt: Date | null;
};

type FakeBook = {
  id: string;
  coinPerChapter: number;
  deletedAt: Date | null;
};

type FakeUser = {
  id: string;
  coinBalance: number;
  deletedAt: Date | null;
};

type FakeSub = {
  id: string;
  userId: string;
  status: string;
  currentPeriodEnd: Date;
};

type FakeUnlock = { userId: string; chapterId: string };

const buildPrismaStub = (state: {
  books: FakeBook[];
  chapters: FakeChapter[];
  users: FakeUser[];
  subs: FakeSub[];
  unlocks: FakeUnlock[];
}) => {
  const findChapter = (id: string) => state.chapters.find((c) => c.id === id) ?? null;
  const findBook = (id: string) => state.books.find((b) => b.id === id) ?? null;

  return {
    chapter: {
      findFirst: jest.fn(
        async ({
          where,
          orderBy,
        }: {
          where: Record<string, unknown>;
          orderBy?: { order?: 'asc' | 'desc' };
        }) => {
          const id = where.id as string | undefined;
          if (id) {
            const c = findChapter(id);
            if (!c || c.deletedAt) return null;
            const book = findBook(c.bookId);
            return { ...c, book };
          }
          // prev/next lookups
          const bookId = where.bookId as string | undefined;
          const orderFilter = where.order as { lt?: number; gt?: number } | undefined;
          if (bookId && orderFilter) {
            const candidates = state.chapters
              .filter(
                (c) =>
                  c.bookId === bookId &&
                  !c.deletedAt &&
                  ((orderFilter.lt !== undefined && c.order < orderFilter.lt) ||
                    (orderFilter.gt !== undefined && c.order > orderFilter.gt)),
              )
              .slice();
            candidates.sort((a, b) =>
              orderBy?.order === 'desc' ? b.order - a.order : a.order - b.order,
            );
            return candidates[0] ?? null;
          }
          return null;
        },
      ),
    },
    chapterUnlock: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { userId_chapterId: { userId: string; chapterId: string } };
        }) => {
          const { userId, chapterId } = where.userId_chapterId;
          const u = state.unlocks.find((x) => x.userId === userId && x.chapterId === chapterId);
          return u ? { id: 'unlock-1' } : null;
        },
      ),
    },
    subscription: {
      findFirst: jest.fn(async ({ where }: { where: { userId: string } }) => {
        const sub = state.subs.find(
          (s) => s.userId === where.userId && s.currentPeriodEnd.getTime() > Date.now(),
        );
        return sub ? { id: sub.id } : null;
      }),
    },
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) =>
          state.users.find((u) => u.id === where.id) ?? null,
      ),
    },
  };
};

const buildStubs = () => {
  const cache = {
    get: jest.fn(async () => null as string | null),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
  };
  const storage = {
    uploadText: jest.fn(async () => undefined),
    getSignedUrl: jest.fn(async (key: string) => `https://cdn.test/${key}?sig=ok`),
    getText: jest.fn(
      async () => 'The wind howled through the trees as Luna stepped into the clearing.',
    ),
  };
  return { cache, storage };
};

const FREE_CHAPTER: FakeChapter = {
  id: '00000000-0000-0000-0000-000000000001',
  bookId: '00000000-0000-0000-0000-000000000010',
  order: 1,
  title: 'The Encounter',
  contentUrl: 'chapters/book/free.txt',
  wordCount: 1200,
  isFree: true,
  deletedAt: null,
};

const PAID_CHAPTER: FakeChapter = {
  id: '00000000-0000-0000-0000-000000000002',
  bookId: '00000000-0000-0000-0000-000000000010',
  order: 4,
  title: 'Bound',
  contentUrl: 'chapters/book/paid.txt',
  wordCount: 1500,
  isFree: false,
  deletedAt: null,
};

const NEXT_PAID_CHAPTER: FakeChapter = {
  id: '00000000-0000-0000-0000-000000000003',
  bookId: '00000000-0000-0000-0000-000000000010',
  order: 5,
  title: 'The Truth',
  contentUrl: 'chapters/book/paid2.txt',
  wordCount: 1700,
  isFree: false,
  deletedAt: null,
};

const BOOK: FakeBook = {
  id: '00000000-0000-0000-0000-000000000010',
  coinPerChapter: 5,
  deletedAt: null,
};

const buildState = (
  overrides: Partial<{
    users: FakeUser[];
    subs: FakeSub[];
    unlocks: FakeUnlock[];
  }> = {},
) => ({
  books: [BOOK],
  chapters: [FREE_CHAPTER, PAID_CHAPTER, NEXT_PAID_CHAPTER],
  users: overrides.users ?? [],
  subs: overrides.subs ?? [],
  unlocks: overrides.unlocks ?? [],
});

describe('ChaptersService access matrix', () => {
  const buildService = (
    state: ReturnType<typeof buildState>,
  ): {
    service: ChaptersService;
    stubs: ReturnType<typeof buildStubs>;
  } => {
    const stubs = buildStubs();
    const deps = {
      prisma: buildPrismaStub(state),
      storage: stubs.storage,
      cache: stubs.cache,
    } as unknown as ChaptersServiceDeps;
    return { service: new ChaptersService(deps), stubs };
  };

  it('guest reading a free chapter → unlocked with content URL', async () => {
    const { service } = await buildService(buildState());
    const res = await service.readChapter(FREE_CHAPTER.id, null);
    expect(res.isLocked).toBe(false);
    if (!res.isLocked) {
      expect(res.contentUrl).toContain('chapters/book/free.txt');
      expect(res.prevChapterId).toBeNull();
      expect(res.nextChapterId).toBe(PAID_CHAPTER.id);
    }
  });

  it('guest reading a paid chapter → locked with preview + unlock options', async () => {
    const { service } = await buildService(buildState());
    const res = await service.readChapter(PAID_CHAPTER.id, null);
    expect(res.isLocked).toBe(true);
    if (res.isLocked) {
      expect(res.preview.length).toBeGreaterThan(0);
      expect(res.preview.length).toBeLessThanOrEqual(100);
      expect(res.unlockOptions.coinCost).toBe(5);
      expect(res.unlockOptions.canUnlockWithCoins).toBe(false);
      expect(res.unlockOptions.canUnlockWithSubscription).toBe(false);
    }
  });

  it('logged-in user with no coins/sub on paid chapter → locked, cannot unlock', async () => {
    const { service } = await buildService(
      buildState({
        users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }],
      }),
    );
    const res = await service.readChapter(PAID_CHAPTER.id, 'user-1');
    expect(res.isLocked).toBe(true);
    if (res.isLocked) {
      expect(res.unlockOptions.canUnlockWithCoins).toBe(false);
      expect(res.unlockOptions.canUnlockWithSubscription).toBe(false);
    }
  });

  it('user with enough coins on paid chapter → locked but canUnlockWithCoins=true', async () => {
    const { service } = await buildService(
      buildState({
        users: [{ id: 'user-1', coinBalance: 50, deletedAt: null }],
      }),
    );
    const res = await service.readChapter(PAID_CHAPTER.id, 'user-1');
    expect(res.isLocked).toBe(true);
    if (res.isLocked) {
      expect(res.unlockOptions.canUnlockWithCoins).toBe(true);
      expect(res.unlockOptions.canUnlockWithSubscription).toBe(false);
    }
  });

  it('subscriber on paid chapter → unlocked', async () => {
    const { service } = await buildService(
      buildState({
        users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }],
        subs: [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 7 * 86400 * 1000),
          },
        ],
      }),
    );
    const res = await service.readChapter(PAID_CHAPTER.id, 'user-1');
    expect(res.isLocked).toBe(false);
  });

  it('user who already owns a chapter unlock → unlocked', async () => {
    const { service } = await buildService(
      buildState({
        users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }],
        unlocks: [{ userId: 'user-1', chapterId: PAID_CHAPTER.id }],
      }),
    );
    const res = await service.readChapter(PAID_CHAPTER.id, 'user-1');
    expect(res.isLocked).toBe(false);
  });

  it('unlocked chapter response includes prev/next chapter ids', async () => {
    const { service } = await buildService(
      buildState({
        unlocks: [{ userId: 'user-1', chapterId: PAID_CHAPTER.id }],
        users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }],
      }),
    );
    const res = await service.readChapter(PAID_CHAPTER.id, 'user-1');
    expect(res.isLocked).toBe(false);
    if (!res.isLocked) {
      expect(res.prevChapterId).toBe(FREE_CHAPTER.id);
      expect(res.nextChapterId).toBe(NEXT_PAID_CHAPTER.id);
    }
  });

  describe('unlock eligibility decisions', () => {
    const expectDecision = async (
      state: ReturnType<typeof buildState>,
      chapterId: string,
      userId: string | null,
      expected: { decision: 'unlocked' | 'locked'; reason: string },
    ) => {
      const { service } = await buildService(state);
      const res = await service.readChapter(chapterId, userId);
      const actual = {
        decision: res.isLocked ? 'locked' : 'unlocked',
        reason: res.isLocked ? 'paywall' : expected.reason,
      };
      expect(actual).toEqual(expected);
      return res;
    };

    it('free chapter: unlocked because chapter is free', async () => {
      await expectDecision(buildState(), FREE_CHAPTER.id, null, {
        decision: 'unlocked',
        reason: 'free_chapter',
      });
    });

    it('active subscription: unlocked because user has an active subscription', async () => {
      await expectDecision(
        buildState({
          users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }],
          subs: [
            {
              id: 'sub-1',
              userId: 'user-1',
              status: 'active',
              currentPeriodEnd: new Date(Date.now() + 7 * 86400 * 1000),
            },
          ],
        }),
        PAID_CHAPTER.id,
        'user-1',
        { decision: 'unlocked', reason: 'active_subscription' },
      );
    });

    it('already-unlocked chapter: unlocked because user owns a chapter unlock', async () => {
      await expectDecision(
        buildState({
          users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }],
          unlocks: [{ userId: 'user-1', chapterId: PAID_CHAPTER.id }],
        }),
        PAID_CHAPTER.id,
        'user-1',
        { decision: 'unlocked', reason: 'already_unlocked' },
      );
    });

    it('paywall: locked because paid chapter has no subscription or unlock', async () => {
      await expectDecision(
        buildState({ users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }] }),
        PAID_CHAPTER.id,
        'user-1',
        { decision: 'locked', reason: 'paywall' },
      );
    });
  });

  it('preview is read from cache when present (no R2 fetch)', async () => {
    const { service, stubs } = await buildService(buildState());
    stubs.cache.get.mockResolvedValueOnce('cached preview snippet');
    const res = await service.readChapter(PAID_CHAPTER.id, null);
    expect(res.isLocked).toBe(true);
    if (res.isLocked) {
      expect(res.preview).toBe('cached preview snippet');
    }
    expect(stubs.storage.getText).not.toHaveBeenCalled();
  });

  it('NotFound for unknown chapter id', async () => {
    const { service } = await buildService(buildState());
    await expect(service.readChapter('00000000-0000-0000-0000-000000000999', null)).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 404 }),
    );
  });

  it('NotFound when book is soft-deleted', async () => {
    const state = buildState();
    state.books[0]!.deletedAt = new Date();
    const { service } = await buildService(state);
    await expect(service.readChapter(PAID_CHAPTER.id, null)).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 404 }),
    );
  });
});
