import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import type { WorkerEnv } from '../services/auth-factory';
import { makeCheckinService, makeCoinsService } from '../services/user-factory';
import { checkinRoutes } from './checkin';

jest.mock('../sentry', () => ({
  setSentryUser: jest.fn(),
}));

jest.mock('../services/user-factory', () => ({
  makeCheckinService: jest.fn(),
  makeCoinsService: jest.fn(),
}));

const mockedMakeCheckinService = jest.mocked(makeCheckinService);
const mockedMakeCoinsService = jest.mocked(makeCoinsService);

const jwtSecret = 'checkin-contract-secret';
const userId = '11111111-1111-4111-8111-111111111111';
const statusResult = {
  checkedInToday: false,
  streak: 3,
  rewardCoins: 10,
};
const claimResult = {
  checkedInToday: true,
  streak: 4,
  rewardCoins: 10,
  balance: 135,
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
  app.route('/checkin', checkinRoutes);
  return app;
};

const env: WorkerEnv = { JWT_SECRET: jwtSecret };

describe('Worker checkin route contracts', () => {
  const getStatus = jest.fn();
  const claim = jest.fn();

  beforeEach(() => {
    getStatus.mockResolvedValue(statusResult);
    claim.mockResolvedValue(claimResult);
    mockedMakeCoinsService.mockReturnValue({} as ReturnType<typeof makeCoinsService>);
    mockedMakeCheckinService.mockReturnValue({
      getStatus,
      claim,
    } as unknown as ReturnType<typeof makeCheckinService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the authenticated checkin status from the mocked service', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/checkin/status',
      { headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(200);
    expect(mockedMakeCheckinService).toHaveBeenCalledTimes(1);
    expect(mockedMakeCoinsService).toHaveBeenCalledTimes(1);
    expect(getStatus).toHaveBeenCalledWith(userId);
    expect(claim).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(statusResult);
  });

  it('claims the authenticated daily checkin from the mocked service without body validation', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/checkin',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      },
      env,
    );

    expect(response.status).toBe(201);
    expect(mockedMakeCheckinService).toHaveBeenCalledTimes(1);
    expect(mockedMakeCoinsService).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith(userId);
    expect(getStatus).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(claimResult);
  });

  it('returns the standard error envelope when the mocked service throws', async () => {
    claim.mockRejectedValueOnce(DomainError.conflict('Already checked in today'));
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/checkin',
      { method: 'POST', headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 409,
      error: 'Error',
      message: 'Already checked in today',
    });
    expect(mockedMakeCheckinService).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith(userId);
  });

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
    'returns 401 for %s without constructing checkin services',
    async (_name, tokenOrPromise, prisma) => {
      const app = buildApp(prisma);
      const token = tokenOrPromise ? await tokenOrPromise : undefined;

      const response = await app.request(
        '/checkin/status',
        token ? { headers: { cookie: makeCookie(token) } } : undefined,
        env,
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Unauthorized',
      });
      expect(mockedMakeCheckinService).not.toHaveBeenCalled();
      expect(mockedMakeCoinsService).not.toHaveBeenCalled();
      expect(getStatus).not.toHaveBeenCalled();
      expect(claim).not.toHaveBeenCalled();
    },
  );
});
