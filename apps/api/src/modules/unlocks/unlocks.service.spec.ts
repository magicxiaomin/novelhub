import { COIN_TXN_TYPE } from '../coins/coins.constants';
import { CoinsService } from '../coins/coins.service';

import { UNLOCK_METHOD } from './unlocks.constants';
import { UnlocksService, type UnlocksServiceDeps } from './unlocks.service';

type FakeChapter = {
  id: string;
  bookId: string;
  isFree: boolean;
  deletedAt: Date | null;
  book: { id: string; coinPerChapter: number; deletedAt: Date | null };
};

type FakeUnlock = {
  id: string;
  userId: string;
  chapterId: string;
  method: string;
  unlockedAt: Date;
};

type FakeUser = { id: string; coinBalance: number; deletedAt: Date | null };

type FakeTxn = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  relatedId: string | null;
  balanceAfter: number;
};

const buildPrismaStub = (state: {
  users: FakeUser[];
  chapters: FakeChapter[];
  unlocks: FakeUnlock[];
  txns: FakeTxn[];
  hasSubscription: boolean;
}) => {
  const usersById = new Map(state.users.map((u) => [u.id, u]));
  let unlockCounter = 0;
  let txnCounter = 0;

  const chapterUnlockClient = {
    findUnique: async ({
      where,
    }: {
      where: { userId_chapterId: { userId: string; chapterId: string } };
    }) => {
      const { userId, chapterId } = where.userId_chapterId;
      return state.unlocks.find((u) => u.userId === userId && u.chapterId === chapterId) ?? null;
    },
    create: async ({ data }: { data: { userId: string; chapterId: string; method: string } }) => {
      // Enforce the unique (userId, chapterId) constraint.
      if (state.unlocks.some((u) => u.userId === data.userId && u.chapterId === data.chapterId)) {
        const err = new Error('unique constraint failed') as Error & {
          code: string;
        };
        err.code = 'P2002';
        throw err;
      }
      unlockCounter += 1;
      const u: FakeUnlock = {
        id: `unlock-${unlockCounter}`,
        ...data,
        unlockedAt: new Date(),
      };
      state.unlocks.push(u);
      return u;
    },
    findMany: async ({
      where,
      skip = 0,
      take = 100,
    }: {
      where: { userId: string };
      skip?: number;
      take?: number;
    }) => state.unlocks.filter((u) => u.userId === where.userId).slice(skip, skip + take),
    count: async ({ where }: { where: { userId: string } }) =>
      state.unlocks.filter((u) => u.userId === where.userId).length,
  };

  const chapterClient = {
    findFirst: async ({ where }: { where: { id: string } }) => {
      const c = state.chapters.find((ch) => ch.id === where.id);
      if (!c || c.deletedAt) return null;
      return c;
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      state.chapters.find((c) => c.id === where.id) ?? null,
  };

  const userClient = {
    findUnique: async ({ where }: { where: { id: string } }) => usersById.get(where.id) ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        id: string;
        deletedAt?: null;
        coinBalance?: { gte?: number };
      };
      data: { coinBalance: { increment: number } };
    }) => {
      const u = usersById.get(where.id);
      if (!u || u.deletedAt) return { count: 0 };
      if (where.coinBalance?.gte !== undefined) {
        if (u.coinBalance < where.coinBalance.gte) return { count: 0 };
      }
      u.coinBalance += data.coinBalance.increment;
      return { count: 1 };
    },
  };

  const subscriptionClient = {
    findFirst: async () => (state.hasSubscription ? { id: 'sub-1' } : null),
  };

  const coinTransactionClient = {
    create: async ({ data, select }: { data: Omit<FakeTxn, 'id'>; select?: { id: boolean } }) => {
      txnCounter += 1;
      const t: FakeTxn = { id: `txn-${txnCounter}`, ...data };
      state.txns.push(t);
      return select?.id ? { id: t.id } : t;
    },
  };

  type PrismaShape = {
    chapterUnlock: typeof chapterUnlockClient;
    chapter: typeof chapterClient;
    user: typeof userClient;
    subscription: typeof subscriptionClient;
    coinTransaction: typeof coinTransactionClient;
    $transaction: <T>(cb: (tx: PrismaShape) => Promise<T>) => Promise<T>;
  };
  const prisma: PrismaShape = {
    chapterUnlock: chapterUnlockClient,
    chapter: chapterClient,
    user: userClient,
    subscription: subscriptionClient,
    coinTransaction: coinTransactionClient,
    $transaction: async (cb) => cb(prisma),
  };
  return prisma;
};

const buildState = (
  overrides: Partial<{
    users: FakeUser[];
    hasSubscription: boolean;
    chapter: FakeChapter;
  }> = {},
) => {
  const defaultChapter: FakeChapter = {
    id: 'chapter-1',
    bookId: 'book-1',
    isFree: false,
    deletedAt: null,
    book: { id: 'book-1', coinPerChapter: 5, deletedAt: null },
  };
  return {
    users: overrides.users ?? [{ id: 'user-1', coinBalance: 50, deletedAt: null }],
    chapters: [overrides.chapter ?? defaultChapter],
    unlocks: [] as FakeUnlock[],
    txns: [] as FakeTxn[],
    hasSubscription: overrides.hasSubscription ?? false,
  };
};

describe('UnlocksService', () => {
  const buildService = (
    state: ReturnType<typeof buildState>,
  ): { service: UnlocksService; state: typeof state } => {
    const prismaStub = buildPrismaStub(state);
    const coins = new CoinsService({ prisma: prismaStub } as never);
    const deps = { prisma: prismaStub, coins } as unknown as UnlocksServiceDeps;
    return { service: new UnlocksService(deps), state };
  };

  it('happy path: spends coinPerChapter and writes COINS unlock', async () => {
    const { service, state } = buildService(buildState());
    const r = await service.unlockChapter('user-1', 'chapter-1');
    expect(r.method).toBe(UNLOCK_METHOD.COINS);
    expect(state.unlocks).toHaveLength(1);
    expect(state.users[0]?.coinBalance).toBe(45);
    expect(state.txns[0]).toMatchObject({
      amount: -5,
      type: COIN_TXN_TYPE.CHAPTER_UNLOCK,
      relatedId: 'chapter-1',
      balanceAfter: 45,
    });
  });

  it('idempotent: returns existing unlock without charging coins again', async () => {
    const { service, state } = buildService(buildState());
    await service.unlockChapter('user-1', 'chapter-1');
    expect(state.users[0]?.coinBalance).toBe(45);
    const r = await service.unlockChapter('user-1', 'chapter-1');
    expect(r.method).toBe(UNLOCK_METHOD.COINS);
    expect(state.users[0]?.coinBalance).toBe(45);
    expect(state.unlocks).toHaveLength(1);
  });

  it('subscriber: writes SUBSCRIPTION unlock without coin charge', async () => {
    const { service, state } = buildService(
      buildState({
        hasSubscription: true,
        users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }],
      }),
    );
    const r = await service.unlockChapter('user-1', 'chapter-1');
    expect(r.method).toBe(UNLOCK_METHOD.SUBSCRIPTION);
    expect(state.users[0]?.coinBalance).toBe(0);
    expect(state.txns).toHaveLength(0);
    expect(state.unlocks).toHaveLength(1);
  });

  it('free chapter: 400 BadRequest', async () => {
    const { service } = buildService(
      buildState({
        chapter: {
          id: 'chapter-1',
          bookId: 'book-1',
          isFree: true,
          deletedAt: null,
          book: { id: 'book-1', coinPerChapter: 5, deletedAt: null },
        },
      }),
    );
    await expect(service.unlockChapter('user-1', 'chapter-1')).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 400 }),
    );
  });

  it('insufficient balance: 402 PaymentRequired with paywall envelope', async () => {
    const { service } = buildService(
      buildState({ users: [{ id: 'user-1', coinBalance: 3, deletedAt: null }] }),
    );
    const promise = service.unlockChapter('user-1', 'chapter-1');
    await expect(promise).rejects.toEqual(
      expect.objectContaining({
        name: 'DomainError',
        status: 402,
        context: expect.objectContaining({
          chapterId: 'chapter-1',
          coinCost: 5,
          currentBalance: 3,
        }),
      }),
    );
  });

  it('insufficient balance: does not debit coins or write txn', async () => {
    const { service, state } = buildService(
      buildState({ users: [{ id: 'user-1', coinBalance: 3, deletedAt: null }] }),
    );
    await expect(service.unlockChapter('user-1', 'chapter-1')).rejects.toThrow();
    expect(state.users[0]?.coinBalance).toBe(3);
    expect(state.txns).toHaveLength(0);
    expect(state.unlocks).toHaveLength(0);
  });

  it('unknown chapter: 404', async () => {
    const { service } = buildService(buildState());
    await expect(service.unlockChapter('user-1', 'missing')).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 404 }),
    );
  });

  it('chapter on soft-deleted book: 404', async () => {
    const state = buildState();
    state.chapters[0]!.book.deletedAt = new Date();
    const { service } = buildService(state);
    await expect(service.unlockChapter('user-1', 'chapter-1')).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 404 }),
    );
  });

  it('concurrent unlocks: exactly one COINS spend, others reuse the unlock', async () => {
    const { service, state } = buildService(
      buildState({ users: [{ id: 'user-1', coinBalance: 5, deletedAt: null }] }),
    );
    const attempts = Array.from({ length: 10 }, () =>
      service
        .unlockChapter('user-1', 'chapter-1')
        .then((u) => ({ ok: true as const, method: u.method }))
        .catch((e) => ({ ok: false as const, status: (e as { status?: number }).status })),
    );
    const results = await Promise.all(attempts);
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    // Exactly one txn was written and the user's balance is 0
    expect(state.txns).toHaveLength(1);
    expect(state.users[0]?.coinBalance).toBe(0);
    expect(state.unlocks).toHaveLength(1);

    // All successes carry method=COINS (the one that spent, plus idempotent re-reads)
    expect(successes.every((s) => s.method === UNLOCK_METHOD.COINS)).toBe(true);
    // Failures (if any) are 402 — happens when a parallel attempt sees
    // empty balance before noticing the unlock now exists.
    expect(failures.every((f) => f.status === 402)).toBe(true);
    expect(successes.length + failures.length).toBe(10);
    expect(successes.length).toBeGreaterThan(0);
  });
});
