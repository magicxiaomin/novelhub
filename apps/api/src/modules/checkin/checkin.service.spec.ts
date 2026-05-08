import { COIN_TXN_TYPE } from '../coins/coins.constants';
import { CoinsService } from '../coins/coins.service';

import { REWARD_BY_DAY } from './checkin.constants';
import { CheckinService, type CheckinServiceDeps } from './checkin.service';

type FakeUser = { id: string; coinBalance: number; deletedAt: Date | null };
type FakeCheckin = {
  userId: string;
  checkinDate: Date;
  streakCount: number;
  coinsAwarded: number;
};
type FakeCoinTransaction = {
  userId: string;
  amount: number;
  type: string;
  relatedId: string | null;
  balanceAfter: number;
};

const utcDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
};

const buildPrismaStub = (state: {
  users: Map<string, FakeUser>;
  checkins: FakeCheckin[];
  transactions: FakeCoinTransaction[];
}) => {
  const dailyCheckinClient = {
    findFirst: async ({
      where,
    }: {
      where: { userId: string };
      orderBy?: { checkinDate: 'desc' };
      select?: { checkinDate: boolean; streakCount: boolean; coinsAwarded: boolean };
    }): Promise<FakeCheckin | null> =>
      state.checkins
        .filter((row) => row.userId === where.userId)
        .sort((a, b) => b.checkinDate.getTime() - a.checkinDate.getTime())[0] ?? null,
    create: async ({ data }: { data: FakeCheckin }): Promise<FakeCheckin> => {
      state.checkins.push(data);
      return data;
    },
  };

  const userClient = {
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; deletedAt: null };
      data: { coinBalance: { increment: number } };
    }): Promise<{ count: number }> => {
      const user = state.users.get(where.id);
      if (!user || user.deletedAt !== null) return { count: 0 };
      user.coinBalance += data.coinBalance.increment;
      return { count: 1 };
    },
    findUnique: async ({
      where,
    }: {
      where: { id: string };
      select?: { coinBalance: boolean };
    }): Promise<{ coinBalance: number } | null> => {
      const user = state.users.get(where.id);
      return user ? { coinBalance: user.coinBalance } : null;
    },
  };

  const coinTransactionClient = {
    create: async ({ data }: { data: FakeCoinTransaction }): Promise<FakeCoinTransaction> => {
      state.transactions.push(data);
      return data;
    },
  };

  type PrismaShape = {
    dailyCheckin: typeof dailyCheckinClient;
    user: typeof userClient;
    coinTransaction: typeof coinTransactionClient;
    $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaShape) => Promise<unknown>]>;
  };

  const prisma: PrismaShape = {
    dailyCheckin: dailyCheckinClient,
    user: userClient,
    coinTransaction: coinTransactionClient,
    $transaction: jest.fn(async (cb) => cb(prisma)),
  };

  return prisma;
};

describe('CheckinService', () => {
  let service: CheckinService;
  let prisma: ReturnType<typeof buildPrismaStub>;
  let adjustBalance: jest.MockedFunction<CoinsService['adjustBalance']>;
  let coinsService: CoinsService;
  let state: {
    users: Map<string, FakeUser>;
    checkins: FakeCheckin[];
    transactions: FakeCoinTransaction[];
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-06T12:34:56.000Z'));
    state = {
      users: new Map([['user-1', { id: 'user-1', coinBalance: 10, deletedAt: null }]]),
      checkins: [],
      transactions: [],
    };
    prisma = buildPrismaStub(state);
    adjustBalance = jest.fn<
      ReturnType<CoinsService['adjustBalance']>,
      Parameters<CoinsService['adjustBalance']>
    >(async (...args) => {
      const [userId, amount] = args;
      const user = state.users.get(userId);
      if (!user) throw new Error('User not found');
      user.coinBalance += amount;
      return { balance: user.coinBalance, transactionId: 'coin-transaction-1' };
    });
    coinsService = { adjustBalance } as unknown as CoinsService;
    const deps = { prisma, coins: coinsService } as unknown as CheckinServiceDeps;
    service = new CheckinService(deps);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns status with no prior checkin', async () => {
    await expect(service.getStatus('user-1')).resolves.toEqual({
      today: '2026-05-06',
      claimedToday: false,
      streakCount: 0,
      nextReward: REWARD_BY_DAY[1],
      todayReward: REWARD_BY_DAY[1],
    });
  });

  it('returns status when today is already claimed', async () => {
    state.checkins.push({
      userId: 'user-1',
      checkinDate: utcDate('2026-05-06'),
      streakCount: 4,
      coinsAwarded: REWARD_BY_DAY[4],
    });

    await expect(service.getStatus('user-1')).resolves.toEqual({
      today: '2026-05-06',
      claimedToday: true,
      streakCount: 4,
      nextReward: REWARD_BY_DAY[5],
      todayReward: REWARD_BY_DAY[4],
    });
  });

  it('returns status when yesterday was claimed and preserves the current streak', async () => {
    state.checkins.push({
      userId: 'user-1',
      checkinDate: utcDate('2026-05-05'),
      streakCount: 3,
      coinsAwarded: REWARD_BY_DAY[3],
    });

    await expect(service.getStatus('user-1')).resolves.toMatchObject({
      claimedToday: false,
      streakCount: 3,
      nextReward: REWARD_BY_DAY[4],
      todayReward: REWARD_BY_DAY[4],
    });
  });

  it('resets status after a gap longer than one day', async () => {
    state.checkins.push({
      userId: 'user-1',
      checkinDate: utcDate('2026-05-04'),
      streakCount: 6,
      coinsAwarded: REWARD_BY_DAY[6],
    });

    await expect(service.getStatus('user-1')).resolves.toMatchObject({
      claimedToday: false,
      streakCount: 0,
      nextReward: REWARD_BY_DAY[1],
      todayReward: REWARD_BY_DAY[1],
    });
  });

  it('claims today in one transaction and adjusts the balance', async () => {
    const result = await service.claim('user-1');

    expect(result).toEqual({
      streakCount: 1,
      coinsAwarded: REWARD_BY_DAY[1],
      newBalance: 15,
    });
    expect(state.checkins).toHaveLength(1);
    expect(state.checkins[0]).toMatchObject({
      userId: 'user-1',
      streakCount: 1,
      coinsAwarded: REWARD_BY_DAY[1],
    });
    expect(adjustBalance).toHaveBeenCalledWith(
      'user-1',
      REWARD_BY_DAY[1],
      COIN_TXN_TYPE.DAILY_CHECKIN,
      null,
      expect.anything(),
    );
  });

  it('throws DomainError(409) when already claimed today', async () => {
    state.checkins.push({
      userId: 'user-1',
      checkinDate: utcDate('2026-05-06'),
      streakCount: 1,
      coinsAwarded: REWARD_BY_DAY[1],
    });

    await expect(service.claim('user-1')).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 409 }),
    );
    expect(adjustBalance).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique-constraint claim race to DomainError(409)', async () => {
    prisma.dailyCheckin.findFirst = async (): Promise<FakeCheckin | null> => null;
    prisma.dailyCheckin.create = async (): Promise<FakeCheckin> => {
      const err = new Error('Unique constraint failed');
      Object.assign(err, { code: 'P2002' });
      throw err;
    };

    await expect(service.claim('user-1')).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 409 }),
    );
    expect(adjustBalance).not.toHaveBeenCalled();
  });

  it('continues the streak from yesterday with the next reward', async () => {
    state.checkins.push({
      userId: 'user-1',
      checkinDate: utcDate('2026-05-05'),
      streakCount: 3,
      coinsAwarded: REWARD_BY_DAY[3],
    });

    await expect(service.claim('user-1')).resolves.toEqual({
      streakCount: 4,
      coinsAwarded: REWARD_BY_DAY[4],
      newBalance: 20,
    });
  });

  it('rolls reward day 8 back to the day 1 reward while keeping the streak count', async () => {
    state.checkins.push({
      userId: 'user-1',
      checkinDate: utcDate('2026-05-05'),
      streakCount: 7,
      coinsAwarded: REWARD_BY_DAY[7],
    });

    await expect(service.claim('user-1')).resolves.toEqual({
      streakCount: 8,
      coinsAwarded: REWARD_BY_DAY[1],
      newBalance: 15,
    });
  });

  it('grants exactly the reward table coins for streak days 1 through 7', async () => {
    const cases: Array<[number, number]> = [
      [1, REWARD_BY_DAY[1]],
      [2, REWARD_BY_DAY[2]],
      [3, REWARD_BY_DAY[3]],
      [4, REWARD_BY_DAY[4]],
      [5, REWARD_BY_DAY[5]],
      [6, REWARD_BY_DAY[6]],
      [7, REWARD_BY_DAY[7]],
    ];

    for (const [streakCount, reward] of cases) {
      state.users.set('user-1', { id: 'user-1', coinBalance: 10, deletedAt: null });
      state.checkins = [];
      state.transactions = [];
      prisma = buildPrismaStub(state);
      adjustBalance = jest.fn<
        ReturnType<CoinsService['adjustBalance']>,
        Parameters<CoinsService['adjustBalance']>
      >(async (...args) => {
        const [userId, amount] = args;
        const user = state.users.get(userId);
        if (!user) throw new Error('User not found');
        user.coinBalance += amount;
        return { balance: user.coinBalance, transactionId: 'coin-transaction-1' };
      });
      coinsService = { adjustBalance } as unknown as CoinsService;
      const deps = { prisma, coins: coinsService } as unknown as CheckinServiceDeps;
      service = new CheckinService(deps);

      if (streakCount > 1) {
        state.checkins.push({
          userId: 'user-1',
          checkinDate: utcDate('2026-05-05'),
          streakCount: streakCount - 1,
          coinsAwarded: REWARD_BY_DAY[1],
        });
      }

      // eslint-disable-next-line no-await-in-loop
      const result = await service.claim('user-1');

      expect(result.coinsAwarded).toBe(reward);
      expect(adjustBalance).toHaveBeenCalledWith(
        'user-1',
        reward,
        COIN_TXN_TYPE.DAILY_CHECKIN,
        null,
        expect.anything(),
      );
    }
  });

  it('uses prisma.$transaction for the claim path', async () => {
    await service.claim('user-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
