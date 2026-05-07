import { Logger } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';

import { COIN_TXN_TYPE } from '../coins/coins.constants';
import { CoinsService } from '../coins/coins.service';

import { ONESIGNAL_DEFAULT_SEGMENT, PUSH_PERMISSION_REWARD_COINS } from './notifications.constants';
import { NotificationsService } from './notifications.service';
import { OneSignalClient } from './one-signal.client';

type TxStub = {
  coinTransaction: {
    findFirst: jest.Mock;
  };
};

type PrismaStub = {
  $transaction: jest.Mock<Promise<unknown>, [(client: TxStub) => Promise<unknown>, unknown?]>;
  readingProgress: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  subscription: {
    findMany: jest.Mock;
  };
};

const buildService = (overrides?: {
  tx?: TxStub;
  prisma?: Partial<PrismaStub>;
  coins?: Partial<CoinsService>;
  oneSignal?: Partial<OneSignalClient>;
}): {
  service: NotificationsService;
  prisma: PrismaStub;
  tx: TxStub;
  coins: CoinsService;
  oneSignal: OneSignalClient;
} => {
  const tx =
    overrides?.tx ??
    ({
      coinTransaction: { findFirst: jest.fn() },
    } satisfies TxStub);
  const prisma: PrismaStub = {
    $transaction: jest.fn((fn: (client: TxStub) => Promise<unknown>) => fn(tx)),
    readingProgress: { findMany: jest.fn(), findFirst: jest.fn() },
    subscription: { findMany: jest.fn() },
    ...overrides?.prisma,
  };
  const coins = {
    adjustBalance: jest.fn(),
    ...overrides?.coins,
  } as unknown as CoinsService;
  const oneSignal = {
    sendNotification: jest.fn(),
    hasActivePushSubscription: jest.fn().mockResolvedValue(true),
    ...overrides?.oneSignal,
  } as unknown as OneSignalClient;

  return {
    service: new NotificationsService(prisma as unknown as PrismaClient, coins, oneSignal),
    prisma,
    tx,
    coins,
    oneSignal,
  };
};

describe('NotificationsService', () => {
  it('grantBonus: grants 10 coins when no prior PUSH_REWARD transaction exists', async () => {
    const { service, prisma, tx, coins, oneSignal } = buildService();
    tx.coinTransaction.findFirst.mockResolvedValue(null);
    jest.spyOn(coins, 'adjustBalance').mockResolvedValue({ balance: 42, transactionId: 'txn-1' });

    await expect(service.grantBonus('user-1')).resolves.toEqual({ granted: true, balance: 42 });
    expect(oneSignal.hasActivePushSubscription).toHaveBeenCalledWith('user-1');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.coinTransaction.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', type: COIN_TXN_TYPE.PUSH_REWARD },
      select: { id: true },
    });
    expect(coins.adjustBalance).toHaveBeenCalledWith(
      'user-1',
      PUSH_PERMISSION_REWARD_COINS,
      COIN_TXN_TYPE.PUSH_REWARD,
      null,
      tx,
    );
  });

  it('grantBonus: returns already_granted when prior PUSH_REWARD transaction exists', async () => {
    const { service, prisma, tx, coins } = buildService();
    tx.coinTransaction.findFirst.mockResolvedValue({ id: 'txn-existing' });

    await expect(service.grantBonus('user-1')).resolves.toEqual({
      granted: false,
      reason: 'already_granted',
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(coins.adjustBalance).not.toHaveBeenCalled();
  });

  it('grantBonus: treats a concurrent serializable transaction loser as already granted', async () => {
    const { service, prisma, tx, coins } = buildService();
    tx.coinTransaction.findFirst.mockResolvedValue(null);
    jest.spyOn(coins, 'adjustBalance').mockResolvedValue({ balance: 42, transactionId: 'txn-1' });
    prisma.$transaction
      .mockImplementationOnce((fn: (client: TxStub) => Promise<unknown>) => fn(tx))
      .mockRejectedValueOnce({ code: 'P2034' });

    await expect(
      Promise.all([service.grantBonus('user-1'), service.grantBonus('user-1')]),
    ).resolves.toEqual([
      { granted: true, balance: 42 },
      { granted: false, reason: 'already_granted' },
    ]);
    expect(coins.adjustBalance).toHaveBeenCalledTimes(1);
  });

  it('broadcast: sends to the default All segment when segmentName is omitted', async () => {
    const { service, oneSignal } = buildService();
    jest.spyOn(oneSignal, 'sendNotification').mockResolvedValue({ sent: true, id: 'push-1' });

    await expect(
      service.broadcast({ title: 'Title', body: 'Body', url: '/read' }),
    ).resolves.toEqual({
      sent: true,
      id: 'push-1',
    });
    expect(oneSignal.sendNotification).toHaveBeenCalledWith({
      title: 'Title',
      body: 'Body',
      url: '/read',
      segments: [ONESIGNAL_DEFAULT_SEGMENT],
    });
  });

  it('findUsersForReEngagement: returns users whose latest read is inside the 24h-28h window', async () => {
    const now = new Date('2026-05-07T12:00:00.000Z');
    const { service, prisma } = buildService();
    prisma.readingProgress.findMany.mockResolvedValue([
      {
        userId: 'user-in-window',
        lastReadAt: new Date('2026-05-06T11:00:00.000Z'),
        book: { id: 'book-1', title: 'Novel One' },
        chapter: { order: 7 },
      },
      {
        userId: 'user-has-newer',
        lastReadAt: new Date('2026-05-06T10:30:00.000Z'),
        book: { id: 'book-2', title: 'Novel Two' },
        chapter: { order: 3 },
      },
      {
        userId: 'user-in-window',
        lastReadAt: new Date('2026-05-06T10:00:00.000Z'),
        book: { id: 'book-1', title: 'Novel One' },
        chapter: { order: 6 },
      },
    ]);
    prisma.readingProgress.findFirst.mockImplementation(
      async ({ where }: { where: { userId: string; lastReadAt: { gt: Date } } }) =>
        where.userId === 'user-has-newer' ? { id: 'progress-newer' } : null,
    );

    await expect(service.findUsersForReEngagement(now)).resolves.toEqual([
      {
        userId: 'user-in-window',
        bookId: 'book-1',
        bookTitle: 'Novel One',
        chapterNumber: 7,
      },
    ]);
    expect(prisma.readingProgress.findMany).toHaveBeenCalledWith({
      where: {
        userId: { not: null },
        lastReadAt: {
          gte: new Date('2026-05-06T08:00:00.000Z'),
          lte: new Date('2026-05-06T12:00:00.000Z'),
        },
      },
      orderBy: { lastReadAt: 'desc' },
      select: {
        userId: true,
        lastReadAt: true,
        book: { select: { id: true, title: true } },
        chapter: { select: { order: true } },
      },
    });
  });

  it('sendReEngagement: targets OneSignal external user ids with reader deep links', async () => {
    const { service, oneSignal } = buildService();
    jest
      .spyOn(service, 'findUsersForReEngagement')
      .mockResolvedValue([
        { userId: 'user-1', bookId: 'book-1', bookTitle: 'Novel One', chapterNumber: 8 },
      ]);
    jest.spyOn(oneSignal, 'sendNotification').mockResolvedValue({ sent: true });

    await service.sendReEngagement(new Date('2026-05-07T12:00:00.000Z'));

    expect(oneSignal.sendNotification).toHaveBeenCalledWith({
      title: 'Continue reading Novel One',
      body: 'Your next chapter is waiting.',
      url: '/read/book-1/8',
      includeExternalUserIds: ['user-1'],
    });
  });

  it('findUsersForRenewal: returns subscriptions ending 3 to 4 days from now', async () => {
    const now = new Date('2026-05-07T09:00:00.000Z');
    const { service, prisma } = buildService();
    prisma.subscription.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);

    await expect(service.findUsersForRenewal(now)).resolves.toEqual([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        currentPeriodEnd: {
          gte: new Date('2026-05-10T09:00:00.000Z'),
          lte: new Date('2026-05-11T09:00:00.000Z'),
        },
        cancelAtPeriodEnd: false,
      },
      select: { userId: true },
    });
  });
});

describe('OneSignalClient', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('sendNotification: short-circuits when ONESIGNAL_REST_API_KEY is unset', async () => {
    delete process.env.ONESIGNAL_REST_API_KEY;
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID = 'app-1';
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new OneSignalClient();

    await expect(client.sendNotification({ title: 'Title', body: 'Body' })).resolves.toEqual({
      sent: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sendNotification: posts URL and external user ids to OneSignal', async () => {
    process.env.ONESIGNAL_REST_API_KEY = 'rest-key';
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID = 'app-1';
    const json = jest.fn().mockResolvedValue({ id: 'push-1' });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json }) as unknown as typeof fetch;

    const client = new OneSignalClient();

    await expect(
      client.sendNotification({
        title: 'Title',
        body: 'Body',
        url: '/me',
        includeExternalUserIds: ['user-1'],
      }),
    ).resolves.toEqual({ sent: true, id: 'push-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://onesignal.com/api/v1/notifications',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Basic rest-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: 'app-1',
          headings: { en: 'Title' },
          contents: { en: 'Body' },
          url: '/me',
          include_external_user_ids: ['user-1'],
        }),
      }),
    );
  });
});
