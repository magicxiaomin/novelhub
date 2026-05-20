import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeBooksService, makeChaptersService } from '../services/catalog-factory';
import type { WorkerEnv } from '../services/auth-factory';
import { booksRoutes } from './books';
import { chaptersRoutes } from './chapters';

jest.mock('../services/catalog-factory', () => ({
  makeBooksService: jest.fn(),
  makeChaptersService: jest.fn(),
}));

const mockedMakeBooksService = jest.mocked(makeBooksService);
const mockedMakeChaptersService = jest.mocked(makeChaptersService);

const bookId = '11111111-1111-4111-8111-111111111111';
const freeChapterId = '11111111-1111-4111-8111-111111111113';
const paidChapterId = '11111111-1111-4111-8111-111111111114';

const getById = jest.fn();
const listChapters = jest.fn();
const readChapter = jest.fn();

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
  app.route('/books', booksRoutes);
  app.route('/chapters', chaptersRoutes);
  return app;
};

describe('Worker novel route contracts', () => {
  beforeEach(() => {
    getById.mockResolvedValue({
      id: bookId,
      title: 'Novel Funnel Test Book',
      freeChapterCount: 3,
      coinPerChapter: 5,
      chapters: [
        { id: 'chapter-1', order: 1, isFree: true },
        { id: 'chapter-2', order: 2, isFree: true },
        { id: freeChapterId, order: 3, isFree: true },
        { id: paidChapterId, order: 4, isFree: false },
      ],
    });
    listChapters.mockResolvedValue({
      items: [
        { id: 'chapter-1', bookId, order: 1, isFree: true },
        { id: 'chapter-2', bookId, order: 2, isFree: true },
        { id: freeChapterId, bookId, order: 3, isFree: true },
        { id: paidChapterId, bookId, order: 4, isFree: false },
      ],
      total: 4,
      page: 1,
      limit: 200,
    });
    readChapter.mockImplementation(async (chapterId: string, userId: string | null) => {
      if (chapterId === paidChapterId && userId !== 'subscriber-user' && userId !== 'coin-user') {
        return {
          id: paidChapterId,
          bookId,
          chapterNumber: 4,
          title: 'The Locked Door',
          isLocked: true,
          preview: 'chapter four preview',
          unlockOptions: {
            coinCost: 5,
            canUnlockWithCoins: false,
            canUnlockWithSubscription: false,
          },
        };
      }
      return {
        id: chapterId,
        bookId,
        chapterNumber: chapterId === freeChapterId ? 3 : 4,
        title: chapterId === freeChapterId ? 'Free Chapter 3' : 'The Locked Door',
        isLocked: false,
        contentUrl: 'https://r2.test/chapter.txt',
        wordCount: 1200,
        prevChapterId: null,
        nextChapterId: chapterId === freeChapterId ? paidChapterId : null,
      };
    });

    mockedMakeBooksService.mockReturnValue({
      getById,
      listChapters,
    } as unknown as ReturnType<typeof makeBooksService>);

    mockedMakeChaptersService.mockReturnValue({
      readChapter,
    } as unknown as ReturnType<typeof makeChaptersService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('exposes detail and chapter list with three free chapters followed by a paid gate', async () => {
    const app = buildApp();
    const detail = await app.request(`/books/${bookId}`);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({ id: bookId, freeChapterCount: 3 });

    const chapters = await app.request(`/books/${bookId}/chapters?page=1&limit=200`);
    expect(chapters.status).toBe(200);
    expect(listChapters).toHaveBeenCalledWith(bookId, { page: 1, limit: 200 });
    const body = (await chapters.json()) as { items: Array<{ order: number; isFree: boolean }> };
    expect(body.items.map((chapter) => [chapter.order, chapter.isFree])).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, false],
    ]);
  });

  it('allows the last free chapter and locks the next anonymous paid chapter with paywall metadata', async () => {
    const app = buildApp();
    const free = await app.request(`/chapters/${freeChapterId}`);
    expect(free.status).toBe(200);
    await expect(free.json()).resolves.toMatchObject({
      isLocked: false,
      nextChapterId: paidChapterId,
    });

    const paid = await app.request(`/chapters/${paidChapterId}`);
    expect(paid.status).toBe(200);
    await expect(paid.json()).resolves.toMatchObject({
      isLocked: true,
      unlockOptions: { coinCost: 5, canUnlockWithCoins: false, canUnlockWithSubscription: false },
    });
  });

  it.each([
    ['/books/not-a-uuid', getById],
    ['/books/not-a-uuid/chapters', listChapters],
    ['/chapters/not-a-uuid', readChapter],
  ])('rejects non-UUID route param %s before calling the service', async (path, service) => {
    const app = buildApp();

    const response = await app.request(path);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
    });
    expect(service).not.toHaveBeenCalled();
  });

  it.each(['page=0', 'limit=201', 'page=1.5', 'limit=2.5', 'page=abc', 'limit=abc'])(
    'rejects invalid /books/:id/chapters query %s before calling the service',
    async (query) => {
      const app = buildApp();

      const response = await app.request(`/books/${bookId}/chapters?${query}`);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(listChapters).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['', {}],
    ['?page=1', { page: 1 }],
    ['?limit=200', { limit: 200 }],
    ['?page=2&limit=50', { page: 2, limit: 50 }],
  ])('forwards accepted /books/:id/chapters pagination query %s', async (query, expectedQuery) => {
    const app = buildApp();

    const response = await app.request(`/books/${bookId}/chapters${query}`);

    expect(response.status).toBe(200);
    expect(listChapters).toHaveBeenCalledWith(bookId, expectedQuery);
  });
});
