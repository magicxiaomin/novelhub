import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
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
const unlockResult = { id: '44444444-4444-4444-8444-444444444444', userId, chapterId };
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
    await expect(response.json()).resolves.toEqual(unlockResult);
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
    await expect(response.json()).resolves.toEqual(unlockList);
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
});
