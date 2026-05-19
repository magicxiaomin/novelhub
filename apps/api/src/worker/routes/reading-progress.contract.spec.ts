import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import type { WorkerEnv } from '../services/auth-factory';
import { makeReadingProgressService } from '../services/user-factory';
import { readingProgressRoutes } from './reading-progress';

jest.mock('../sentry', () => ({
  setSentryUser: jest.fn(),
}));

jest.mock('../services/user-factory', () => ({
  makeReadingProgressService: jest.fn(),
}));

const mockedMakeReadingProgressService = jest.mocked(makeReadingProgressService);

const jwtSecret = 'reading-progress-contract-secret';
const userId = '11111111-1111-4111-8111-111111111111';
const bookId = '22222222-2222-4222-8222-222222222222';
const chapterId = '33333333-3333-4333-8333-333333333333';
const savedProgress = {
  id: '44444444-4444-4444-8444-444444444444',
  userId,
  bookId,
  chapterId,
  scrollPercent: 42,
};
const recentProgress = [savedProgress];

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
  app.route('/reading-progress', readingProgressRoutes);
  return app;
};

const env: WorkerEnv = { JWT_SECRET: jwtSecret };

describe('Worker reading-progress route contracts', () => {
  const save = jest.fn();
  const findOne = jest.fn();
  const listRecent = jest.fn();

  beforeEach(() => {
    save.mockResolvedValue(savedProgress);
    findOne.mockResolvedValue(savedProgress);
    listRecent.mockResolvedValue(recentProgress);
    mockedMakeReadingProgressService.mockReturnValue({
      save,
      findOne,
      listRecent,
    } as unknown as ReturnType<typeof makeReadingProgressService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('saves authenticated POST progress through the reading progress service', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });
    const body = { chapterId, scrollPercent: 42 };

    const response = await app.request(
      '/reading-progress',
      {
        method: 'POST',
        headers: { cookie: makeCookie(token), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(mockedMakeReadingProgressService).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(userId, body);
    expect(findOne).not.toHaveBeenCalled();
    expect(listRecent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(savedProgress);
  });

  it('finds one authenticated progress entry when GET supplies bookId and chapterId', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      `/reading-progress?bookId=${bookId}&chapterId=${chapterId}`,
      { headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(200);
    expect(findOne).toHaveBeenCalledWith(userId, { bookId, chapterId });
    expect(listRecent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(savedProgress);
  });

  it('lists the ten most recent authenticated progress entries when GET has no query', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/reading-progress',
      { headers: { authorization: `Bearer ${token}` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(listRecent).toHaveBeenCalledWith(userId, 10);
    expect(findOne).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(recentProgress);
  });

  it.each([
    [
      'POST missing chapterId',
      '/reading-progress',
      { method: 'POST', body: { scrollPercent: 42 } },
      'chapterId',
    ],
    [
      'POST missing scrollPercent',
      '/reading-progress',
      { method: 'POST', body: { chapterId } },
      'scrollPercent',
    ],
    [
      'POST wrong primitive types',
      '/reading-progress',
      { method: 'POST', body: { chapterId: 123, scrollPercent: 'near-the-top' } },
      'chapterId',
    ],
    [
      'POST out-of-range negative scrollPercent',
      '/reading-progress',
      { method: 'POST', body: { chapterId, scrollPercent: -1 } },
      'scrollPercent',
    ],
    [
      'POST out-of-range high scrollPercent',
      '/reading-progress',
      { method: 'POST', body: { chapterId, scrollPercent: 101 } },
      'scrollPercent',
    ],
    ['GET malformed bookId', '/reading-progress?bookId=not-a-uuid', { method: 'GET' }, 'bookId'],
    [
      'GET malformed chapterId',
      '/reading-progress?chapterId=not-a-uuid',
      { method: 'GET' },
      'chapterId',
    ],
  ] as const)(
    'returns 400 for validation boundary %s without constructing the service',
    async (_name, path, request, messageFragment) => {
      const app = buildApp();
      const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });
      const init: RequestInit = {
        method: request.method,
        headers: { cookie: makeCookie(token) },
      };
      if ('body' in request) {
        init.headers = { ...init.headers, 'content-type': 'application/json' };
        init.body = JSON.stringify(request.body);
      }

      const response = await app.request(path, init, env);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.stringContaining(messageFragment),
      });
      expect(mockedMakeReadingProgressService).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(findOne).not.toHaveBeenCalled();
      expect(listRecent).not.toHaveBeenCalled();
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
        '/reading-progress',
        token ? { headers: { cookie: makeCookie(token) } } : undefined,
        env,
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Unauthorized',
      });
      expect(mockedMakeReadingProgressService).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(findOne).not.toHaveBeenCalled();
      expect(listRecent).not.toHaveBeenCalled();
    },
  );
});
