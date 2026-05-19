import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import type { WorkerEnv } from '../services/auth-factory';
import { makeCoinsService } from '../services/user-factory';
import { coinsRoutes } from './coins';

jest.mock('../sentry', () => ({
  setSentryUser: jest.fn(),
}));

jest.mock('../services/user-factory', () => ({
  makeCoinsService: jest.fn(),
}));

const mockedMakeCoinsService = jest.mocked(makeCoinsService);

const jwtSecret = 'coins-contract-secret';
const userId = '11111111-1111-4111-8111-111111111111';
const balance = { balance: 125 };
const transactions = {
  items: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      userId,
      amount: 25,
      reason: 'purchase',
    },
  ],
  total: 1,
  page: 2,
  limit: 25,
};

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
  app.route('/coins', coinsRoutes);
  return app;
};

const env: WorkerEnv = { JWT_SECRET: jwtSecret };

describe('Worker coins route contracts', () => {
  const getBalance = jest.fn();
  const listTransactions = jest.fn();

  beforeEach(() => {
    getBalance.mockResolvedValue(balance);
    listTransactions.mockResolvedValue(transactions);
    mockedMakeCoinsService.mockReturnValue({
      getBalance,
      listTransactions,
    } as unknown as ReturnType<typeof makeCoinsService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the authenticated coin balance without mutating coin state', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/coins/balance',
      { headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(200);
    expect(mockedMakeCoinsService).toHaveBeenCalledTimes(1);
    expect(getBalance).toHaveBeenCalledWith(userId);
    expect(listTransactions).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(balance);
  });

  it('passes authenticated transaction pagination to the coins service and returns its DTO envelope', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/coins/transactions?page=2&limit=25',
      { headers: { authorization: `Bearer ${token}` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(listTransactions).toHaveBeenCalledWith(userId, 2, 25);
    expect(getBalance).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(transactions);
  });

  it.each(['page=0', 'limit=101', 'page=abc'])(
    'returns 400 for invalid transaction query %s without constructing the service',
    async (query) => {
      const app = buildApp();
      const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

      const response = await app.request(
        `/coins/transactions?${query}`,
        { headers: { cookie: makeCookie(token) } },
        env,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(mockedMakeCoinsService).not.toHaveBeenCalled();
      expect(getBalance).not.toHaveBeenCalled();
      expect(listTransactions).not.toHaveBeenCalled();
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
        '/coins/balance',
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
      expect(getBalance).not.toHaveBeenCalled();
      expect(listTransactions).not.toHaveBeenCalled();
    },
  );
});
