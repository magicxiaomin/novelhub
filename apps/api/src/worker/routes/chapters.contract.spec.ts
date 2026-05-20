import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeChaptersService } from '../services/catalog-factory';
import type { WorkerEnv } from '../services/auth-factory';
import { chaptersRoutes } from './chapters';

jest.mock('../sentry', () => ({
  setSentryUser: jest.fn(),
}));

jest.mock('../services/catalog-factory', () => ({
  makeChaptersService: jest.fn(),
}));

const mockedMakeChaptersService = jest.mocked(makeChaptersService);

const jwtSecret = 'chapters-contract-secret';
const userId = '11111111-1111-4111-8111-111111111115';
const chapterId = '11111111-1111-4111-8111-111111111113';
const chapterResponse = {
  id: chapterId,
  bookId: '11111111-1111-4111-8111-111111111111',
  chapterNumber: 3,
  title: 'Contract Chapter',
  isLocked: false,
  contentUrl: 'https://r2.test/chapter.txt',
  wordCount: 1200,
  prevChapterId: null,
  nextChapterId: null,
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
  app.route('/chapters', chaptersRoutes);
  return app;
};

const env: WorkerEnv = { JWT_SECRET: jwtSecret };

describe('Worker chapters route contracts', () => {
  const readChapter = jest.fn();

  beforeEach(() => {
    readChapter.mockResolvedValue(chapterResponse);
    mockedMakeChaptersService.mockReturnValue({
      readChapter,
    } as unknown as ReturnType<typeof makeChaptersService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('rejects non-UUID chapter ids with the validation envelope before constructing the service', async () => {
    const app = buildApp();

    const response = await app.request('/chapters/not-a-uuid');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.stringContaining('id:'),
    });
    expect(mockedMakeChaptersService).not.toHaveBeenCalled();
    expect(readChapter).not.toHaveBeenCalled();
  });

  it('passes valid chapter ids to the service with anonymous user context and returns the result', async () => {
    const app = buildApp(buildPrisma(null));

    const response = await app.request(`/chapters/${chapterId}`, undefined, env);

    expect(response.status).toBe(200);
    expect(mockedMakeChaptersService).toHaveBeenCalledTimes(1);
    expect(readChapter).toHaveBeenCalledWith(chapterId, null);
    await expect(response.json()).resolves.toEqual(chapterResponse);
  });

  it('passes optional-auth authenticated user context through to readChapter', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      `/chapters/${chapterId}`,
      { headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(200);
    expect(mockedMakeChaptersService).toHaveBeenCalledTimes(1);
    expect(readChapter).toHaveBeenCalledWith(chapterId, userId);
    await expect(response.json()).resolves.toEqual(chapterResponse);
  });

  it('maps readChapter DomainError failures to the standard worker error envelope', async () => {
    const app = buildApp(buildPrisma(null));
    readChapter.mockRejectedValueOnce(
      DomainError.paymentRequired('Unlock required', {
        chapterId,
        coinCost: 9,
        currentBalance: 3,
      }),
    );

    const response = await app.request(`/chapters/${chapterId}`, undefined, env);

    expect(response.status).toBe(402);
    expect(mockedMakeChaptersService).toHaveBeenCalledTimes(1);
    expect(readChapter).toHaveBeenCalledWith(chapterId, null);
    await expect(response.json()).resolves.toEqual({
      statusCode: 402,
      message: 'Unlock required',
      error: 'Error',
      chapterId,
      coinCost: 9,
      currentBalance: 3,
    });
  });

  it('preserves the exact success DTO shape returned by the chapters service', async () => {
    const app = buildApp(buildPrisma(null));

    const response = await app.request(`/chapters/${chapterId}`, undefined, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: chapterId,
      bookId: '11111111-1111-4111-8111-111111111111',
      chapterNumber: 3,
      title: 'Contract Chapter',
      isLocked: false,
      contentUrl: 'https://r2.test/chapter.txt',
      wordCount: 1200,
      prevChapterId: null,
      nextChapterId: null,
    });
  });
});
