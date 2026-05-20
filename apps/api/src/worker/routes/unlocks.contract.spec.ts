import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import { UNLOCK_METHOD } from '../../modules/unlocks/unlocks.constants';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import type { WorkerEnv } from '../services/auth-factory';
import { makeCoinsService, makeUnlocksService } from '../services/user-factory';
import { unlocksRoutes } from './unlocks';

jest.mock('../sentry', () => ({
  setSentryUser: jest.fn(),
}));

jest.mock('../services/user-factory', () => ({
  makeCoinsService: jest.fn(),
  makeUnlocksService: jest.fn(),
}));

const mockedMakeCoinsService = jest.mocked(makeCoinsService);
const mockedMakeUnlocksService = jest.mocked(makeUnlocksService);

const jwtSecret = 'unlocks-contract-secret';
const userId = '11111111-1111-4111-8111-111111111111';
const chapterId = '22222222-2222-4222-8222-222222222222';
const bookId = '33333333-3333-4333-8333-333333333333';
const unlockedAt = new Date('2026-05-20T00:00:00.000Z');
const unlockResult = {
  id: '44444444-4444-4444-8444-444444444444',
  chapterId,
  bookId,
  method: UNLOCK_METHOD.COINS,
  unlockedAt,
};
const unlockResponseJson = { ...unlockResult, unlockedAt: unlockedAt.toISOString() };
const unlockList = { items: [unlockResult], total: 1, page: 3, limit: 10 };

const makeToken = (payload: JwtPayload, secret = jwtSecret) =>
  new JoseJwtClient(secret).signAsync(payload, { expiresIn: '15m' });

const makeCookie = (token: string) => `${COOKIE_ACCESS}=${token}`;

const buildPrisma = (
  user: { id: string; email: string; isAdmin: boolean } | null = {
    id: userId,
    email: 'reader@example.com',
    isAdmin: false,
  },
) =>
  ({
    user: {
      findUnique: jest.fn().mockResolvedValue(
        user
          ? {
              ...user,
              deletedAt: null,
              bannedAt: null,
            }
          : null,
      ),
    },
  }) as unknown as PrismaVariables['prisma'];

const buildApp = (prisma = buildPrisma()) => {
  const app = new Hono<{
    Bindings: WorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();

  app.use('*', async (c, next) => {
    c.set('prisma', prisma);
    await next();
  });
  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        {
          statusCode: err.status,
          message: err.message,
          error: err.status === 400 ? 'Bad Request' : 'Error',
          ...(err.context ?? {}),
        },
        err.status,
      );
    }
    if (err instanceof HTTPException) {
      return c.json(
        {
          statusCode: err.status,
          message: err.message,
          error: err.status === 401 ? 'Unauthorized' : 'Error',
        },
        err.status,
      );
    }
    return c.json(
      { statusCode: 500, message: 'Internal Server Error', error: 'Internal Server Error' },
      500,
    );
  });
  app.route('/unlocks', unlocksRoutes);
  return app;
};

const env: WorkerEnv = { JWT_SECRET: jwtSecret };

type RouteUser = { id: string; coinBalance: number; deletedAt: Date | null };
type RouteChapter = {
  id: string;
  bookId: string;
  isFree: boolean;
  deletedAt: Date | null;
  book: { id: string; coinPerChapter: number; deletedAt: Date | null };
};
type RouteUnlock = {
  id: string;
  userId: string;
  chapterId: string;
  method: string;
  unlockedAt: Date;
};
type RouteTxn = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  relatedId: string | null;
  balanceAfter: number;
};

const buildRouteState = (
  overrides: Partial<{
    user: RouteUser;
    chapter: RouteChapter;
    unlocks: RouteUnlock[];
    throwP2002AfterCreatingExistingUnlock: boolean;
  }> = {},
) => ({
  user: overrides.user ?? { id: userId, coinBalance: 50, deletedAt: null },
  chapter:
    overrides.chapter ??
    ({
      id: chapterId,
      bookId,
      isFree: false,
      deletedAt: null,
      book: { id: bookId, coinPerChapter: 5, deletedAt: null },
    } satisfies RouteChapter),
  unlocks: overrides.unlocks ?? [],
  txns: [] as RouteTxn[],
  throwP2002AfterCreatingExistingUnlock: overrides.throwP2002AfterCreatingExistingUnlock ?? false,
});

type RoutePrismaStub = {
  user: {
    findUnique: () => Promise<RouteUser>;
    updateMany: (args: {
      where: { coinBalance?: { gte?: number } };
      data: { coinBalance: { increment: number } };
    }) => Promise<{ count: number }>;
  };
  chapter: {
    findFirst: (args: { where: { id: string } }) => Promise<RouteChapter | null>;
    findUnique: (args: { where: { id: string } }) => Promise<{ bookId: string } | null>;
  };
  subscription: { findFirst: () => Promise<null> };
  coinTransaction: { create: (args: { data: Omit<RouteTxn, 'id'> }) => Promise<{ id: string }> };
  chapterUnlock: {
    findUnique: (args: {
      where: { userId_chapterId: { userId: string; chapterId: string } };
    }) => Promise<RouteUnlock | null>;
    create: (args: {
      data: { userId: string; chapterId: string; method: string };
    }) => Promise<RouteUnlock>;
    findMany: () => Promise<RouteUnlock[]>;
    count: () => Promise<number>;
  };
  $transaction: <T>(cb: (tx: RoutePrismaStub) => Promise<T>) => Promise<T>;
};

const buildRoutePrismaStub = (state: ReturnType<typeof buildRouteState>) => {
  let txnCounter = 0;
  const prisma: RoutePrismaStub = {
    user: {
      findUnique: jest.fn(async () => state.user),
      updateMany: jest.fn(async ({ where, data }) => {
        if (state.user.deletedAt) return { count: 0 };
        if (
          where.coinBalance?.gte !== undefined &&
          state.user.coinBalance < where.coinBalance.gte
        ) {
          return { count: 0 };
        }
        state.user.coinBalance += data.coinBalance.increment;
        return { count: 1 };
      }),
    },
    chapter: {
      findFirst: jest.fn(async ({ where }) =>
        state.chapter.id === where.id && state.chapter.deletedAt === null ? state.chapter : null,
      ),
      findUnique: jest.fn(async ({ where }) =>
        state.chapter.id === where.id ? { bookId: state.chapter.bookId } : null,
      ),
    },
    subscription: { findFirst: jest.fn(async () => null) },
    coinTransaction: {
      create: jest.fn(async ({ data }) => {
        txnCounter += 1;
        const txn = { id: `txn-${txnCounter}`, ...data };
        state.txns.push(txn);
        return { id: txn.id };
      }),
    },
    chapterUnlock: {
      findUnique: jest.fn(async ({ where }) => {
        const { userId: lookupUserId, chapterId: lookupChapterId } = where.userId_chapterId;
        return (
          state.unlocks.find((u) => u.userId === lookupUserId && u.chapterId === lookupChapterId) ??
          null
        );
      }),
      create: jest.fn(async ({ data }) => {
        if (state.throwP2002AfterCreatingExistingUnlock) {
          state.throwP2002AfterCreatingExistingUnlock = false;
          state.unlocks.push({
            id: unlockResult.id,
            userId: data.userId,
            chapterId: data.chapterId,
            method: UNLOCK_METHOD.COINS,
            unlockedAt,
          });
          const err = new Error('unique constraint failed') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const created = {
          id: unlockResult.id,
          userId: data.userId,
          chapterId: data.chapterId,
          method: data.method,
          unlockedAt,
        };
        state.unlocks.push(created);
        return created;
      }),
      findMany: jest.fn(async () => state.unlocks),
      count: jest.fn(async () => state.unlocks.length),
    },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  };
  return prisma as unknown as PrismaVariables['prisma'];
};

describe('Worker unlocks route contracts', () => {
  const coinsService = { getBalance: jest.fn() };
  const unlockChapter = jest.fn();
  const list = jest.fn();

  beforeEach(() => {
    unlockChapter.mockResolvedValue(unlockResult);
    list.mockResolvedValue(unlockList);
    mockedMakeCoinsService.mockReturnValue(
      coinsService as unknown as ReturnType<typeof makeCoinsService>,
    );
    mockedMakeUnlocksService.mockReturnValue({
      unlockChapter,
      list,
    } as unknown as ReturnType<typeof makeUnlocksService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('unlocks an authenticated chapter by UUID and returns a 201 DTO', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      `/unlocks/chapter/${chapterId}`,
      { method: 'POST', headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(201);
    expect(mockedMakeCoinsService).toHaveBeenCalledTimes(1);
    expect(mockedMakeUnlocksService).toHaveBeenCalledTimes(1);
    expect(unlockChapter).toHaveBeenCalledWith(userId, chapterId);
    expect(list).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(unlockResponseJson);
  });

  it('passes authenticated unlock list filters to the service and returns its paginated DTO', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      `/unlocks?page=3&limit=10&bookId=${bookId}`,
      { headers: { authorization: `Bearer ${token}` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(userId, 3, 10, bookId);
    expect(unlockChapter).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ...unlockList,
      items: [unlockResponseJson],
    });
  });

  it.each([
    ['malformed chapterId param', `/unlocks/chapter/not-a-uuid`, { method: 'POST' }],
    ['page below minimum', '/unlocks?page=0', { method: 'GET' }],
    ['limit above maximum', '/unlocks?limit=101', { method: 'GET' }],
    ['malformed bookId query', '/unlocks?bookId=not-a-uuid', { method: 'GET' }],
  ] as const)(
    'returns 400 for %s without constructing the service',
    async (_name, path, request) => {
      const app = buildApp();
      const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

      const response = await app.request(
        path,
        { method: request.method, headers: { cookie: makeCookie(token) } },
        env,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(mockedMakeCoinsService).not.toHaveBeenCalled();
      expect(mockedMakeUnlocksService).not.toHaveBeenCalled();
      expect(unlockChapter).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing token', undefined, buildPrisma()],
    [
      'invalid user',
      makeToken({ sub: userId, email: 'reader@example.com', type: 'access' }),
      buildPrisma(null),
    ],
    [
      'bad signature',
      makeToken({ sub: userId, email: 'reader@example.com', type: 'access' }, 'wrong-secret'),
      buildPrisma(),
    ],
  ])(
    'returns 401 for %s without constructing the service',
    async (_name, tokenOrPromise, prisma) => {
      const app = buildApp(prisma);
      const token = tokenOrPromise ? await tokenOrPromise : undefined;

      const response = await app.request(
        '/unlocks',
        token ? { headers: { cookie: makeCookie(token) } } : undefined,
        env,
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Unauthorized',
      });
      expect(mockedMakeCoinsService).not.toHaveBeenCalled();
      expect(mockedMakeUnlocksService).not.toHaveBeenCalled();
      expect(unlockChapter).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
    },
  );

  it.each([
    [DomainError.unauthorized('Unauthorized'), 401, 'Error'],
    [
      DomainError.paymentRequired('Insufficient coin balance', {
        chapterId,
        coinCost: 5,
        currentBalance: 3,
      }),
      402,
      'Error',
    ],
    [DomainError.notFound('Chapter not found'), 404, 'Error'],
  ] as const)(
    'maps service DomainError to the worker-route HTTP response envelope',
    async (domainError, status, error) => {
      const app = buildApp();
      const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });
      unlockChapter.mockRejectedValueOnce(domainError);

      const response = await app.request(
        `/unlocks/chapter/${chapterId}`,
        { method: 'POST', headers: { cookie: makeCookie(token) } },
        env,
      );

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        statusCode: status,
        message: domainError.message,
        error,
        ...(domainError.context ?? {}),
      });
      expect(unlockChapter).toHaveBeenCalledWith(userId, chapterId);
    },
  );

  it('returns the Nest controller-compatible 201 unlock DTO envelope through the worker route', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      `/unlocks/chapter/${chapterId}`,
      { method: 'POST', headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(unlockResponseJson);
  });

  it('resolves a stubbed P2002 collision to the existing-unlock 201 response at the route boundary', async () => {
    const actualFactory = jest.requireActual<typeof import('../services/user-factory')>(
      '../services/user-factory',
    );
    mockedMakeCoinsService.mockImplementation(actualFactory.makeCoinsService);
    mockedMakeUnlocksService.mockImplementation(actualFactory.makeUnlocksService);
    const state = buildRouteState({ throwP2002AfterCreatingExistingUnlock: true });
    const app = buildApp(buildRoutePrismaStub(state));
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      `/unlocks/chapter/${chapterId}`,
      { method: 'POST', headers: { cookie: makeCookie(token) } },
      env,
    );

    // This in-memory Prisma stub characterizes only the route/service boundary.
    // It does not prove real PostgreSQL transaction isolation or concurrency behavior.
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(unlockResponseJson);
    expect(state.unlocks).toHaveLength(1);
    expect(state.txns).toHaveLength(1);
  });
});
