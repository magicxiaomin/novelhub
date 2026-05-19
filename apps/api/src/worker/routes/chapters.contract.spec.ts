import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeChaptersService } from '../services/catalog-factory';
import type { WorkerEnv } from '../services/auth-factory';
import { chaptersRoutes } from './chapters';

jest.mock('../services/catalog-factory', () => ({
  makeChaptersService: jest.fn(),
}));

const mockedMakeChaptersService = jest.mocked(makeChaptersService);

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

const buildApp = () => {
  const app = new Hono<{
    Bindings: WorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();
  app.use('*', async (c, next) => {
    c.set('prisma', {} as PrismaVariables['prisma']);
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
    const app = buildApp();

    const response = await app.request(`/chapters/${chapterId}`);

    expect(response.status).toBe(200);
    expect(mockedMakeChaptersService).toHaveBeenCalledTimes(1);
    expect(readChapter).toHaveBeenCalledWith(chapterId, null);
    await expect(response.json()).resolves.toEqual(chapterResponse);
  });
});
