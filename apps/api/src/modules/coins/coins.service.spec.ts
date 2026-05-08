import { COIN_TXN_TYPE } from './coins.constants';
import { CoinsService, type CoinsServiceDeps } from './coins.service';
import { InsufficientBalanceError } from './insufficient-balance.exception';

type FakeUser = { id: string; coinBalance: number; deletedAt: Date | null };
type FakeTxn = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  relatedId: string | null;
  balanceAfter: number;
  createdAt: Date;
};

const buildPrismaStub = () => {
  const users = new Map<string, FakeUser>();
  const txns: FakeTxn[] = [];
  let txnCounter = 0;

  const userClient = {
    findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
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
      const u = users.get(where.id);
      if (!u || u.deletedAt) return { count: 0 };
      if (where.coinBalance?.gte !== undefined) {
        if (u.coinBalance < where.coinBalance.gte) return { count: 0 };
      }
      u.coinBalance += data.coinBalance.increment;
      return { count: 1 };
    },
  };

  const coinTransactionClient = {
    create: async ({
      data,
      select,
    }: {
      data: Omit<FakeTxn, 'id' | 'createdAt'>;
      select?: { id: boolean };
    }) => {
      txnCounter += 1;
      const t: FakeTxn = {
        id: `txn-${txnCounter}`,
        createdAt: new Date(),
        ...data,
      };
      txns.push(t);
      return select?.id ? { id: t.id } : t;
    },
    count: async ({ where }: { where: { userId: string } }) =>
      txns.filter((t) => t.userId === where.userId).length,
    findMany: async ({
      where,
      skip = 0,
      take = 100,
    }: {
      where: { userId: string };
      orderBy?: unknown;
      skip?: number;
      take?: number;
      select?: unknown;
    }) => txns.filter((t) => t.userId === where.userId).slice(skip, skip + take),
  };

  type PrismaShape = {
    user: typeof userClient;
    coinTransaction: typeof coinTransactionClient;
    $transaction: <T>(cb: (tx: PrismaShape) => Promise<T>) => Promise<T>;
  };
  const prisma: PrismaShape = {
    user: userClient,
    coinTransaction: coinTransactionClient,
    $transaction: async (cb) => cb(prisma),
  };

  return { prisma, users, txns };
};

describe('CoinsService', () => {
  let service: CoinsService;
  let stub: ReturnType<typeof buildPrismaStub>;

  beforeEach(() => {
    stub = buildPrismaStub();
    service = new CoinsService({ prisma: stub.prisma } as unknown as CoinsServiceDeps);
  });

  it('grants coins and writes a txn row with balanceAfter', async () => {
    stub.users.set('u1', { id: 'u1', coinBalance: 0, deletedAt: null });
    const r = await service.adjustBalance('u1', 20, COIN_TXN_TYPE.SIGNUP_BONUS);
    expect(r.balance).toBe(20);
    expect(stub.txns).toHaveLength(1);
    expect(stub.txns[0]).toMatchObject({
      amount: 20,
      type: COIN_TXN_TYPE.SIGNUP_BONUS,
      balanceAfter: 20,
    });
  });

  it('spends coins and writes a negative-amount txn', async () => {
    stub.users.set('u1', { id: 'u1', coinBalance: 50, deletedAt: null });
    const r = await service.adjustBalance('u1', -5, COIN_TXN_TYPE.CHAPTER_UNLOCK, 'chapter-1');
    expect(r.balance).toBe(45);
    expect(stub.txns[0]).toMatchObject({
      amount: -5,
      relatedId: 'chapter-1',
      balanceAfter: 45,
    });
  });

  it('throws InsufficientBalanceError without writing a txn when spend > balance', async () => {
    stub.users.set('u1', { id: 'u1', coinBalance: 3, deletedAt: null });
    await expect(
      service.adjustBalance('u1', -5, COIN_TXN_TYPE.CHAPTER_UNLOCK),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
    expect(stub.txns).toHaveLength(0);
    expect(stub.users.get('u1')?.coinBalance).toBe(3);
  });

  it('throws DomainError(404) for unknown / soft-deleted user', async () => {
    await expect(
      service.adjustBalance('ghost', 10, COIN_TXN_TYPE.ADMIN_ADJUSTMENT),
    ).rejects.toEqual(expect.objectContaining({ name: 'DomainError', status: 404 }));

    stub.users.set('dead', { id: 'dead', coinBalance: 0, deletedAt: new Date() });
    await expect(service.adjustBalance('dead', 10, COIN_TXN_TYPE.ADMIN_ADJUSTMENT)).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 404 }),
    );
  });

  it('amount=0 is a no-op (no txn row)', async () => {
    stub.users.set('u1', { id: 'u1', coinBalance: 50, deletedAt: null });
    const r = await service.adjustBalance('u1', 0, COIN_TXN_TYPE.ADMIN_ADJUSTMENT);
    expect(r.balance).toBe(50);
    expect(stub.txns).toHaveLength(0);
  });

  it('listTransactions paginates and returns descending order via mock', async () => {
    stub.users.set('u1', { id: 'u1', coinBalance: 0, deletedAt: null });
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await service.adjustBalance('u1', 5, COIN_TXN_TYPE.DAILY_CHECKIN);
    }
    const list = await service.listTransactions('u1', 1, 3);
    expect(list.total).toBe(5);
    expect(list.items).toHaveLength(3);
  });

  it('concurrent spends do not allow negative balance (race-condition guard)', async () => {
    stub.users.set('u1', { id: 'u1', coinBalance: 5, deletedAt: null });
    // 10 parallel unlocks costing 5 each — only one should succeed (balance 5).
    const attempts = Array.from({ length: 10 }, () =>
      service
        .adjustBalance('u1', -5, COIN_TXN_TYPE.CHAPTER_UNLOCK)
        .then(() => 'ok' as const)
        .catch((e) =>
          e instanceof InsufficientBalanceError ? ('insufficient' as const) : 'other',
        ),
    );
    const results = await Promise.all(attempts);
    const successes = results.filter((r) => r === 'ok').length;
    const failures = results.filter((r) => r === 'insufficient').length;
    expect(successes).toBe(1);
    expect(failures).toBe(9);
    expect(stub.users.get('u1')?.coinBalance).toBe(0);
    expect(stub.txns).toHaveLength(1);
  });
});
