import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeBooksService } from '../services/catalog-factory';
import type { WorkerEnv } from '../services/auth-factory';
import { booksRoutes } from './books';

jest.mock('../services/catalog-factory', () => ({
  makeBooksService: jest.fn(),
}));

const mockedMakeBooksService = jest.mocked(makeBooksService);

const bookSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Worker Contract Novel',
  author: 'Contract Author',
  coverUrl: 'https://cdn.test/cover.jpg',
  category: 'romance',
  tags: ['contract', 'worker'],
  status: 'ONGOING',
  isFeatured: true,
  totalChapters: 24,
  freeChapterCount: 3,
  coinPerChapter: 5,
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
  app.route('/books', booksRoutes);
  return app;
};

describe('Worker books route contracts', () => {
  const list = jest.fn();
  const search = jest.fn();
  const trending = jest.fn();
  const categories = jest.fn();

  beforeEach(() => {
    list.mockResolvedValue({ items: [bookSummary], total: 21, page: 2, limit: 5 });
    search.mockResolvedValue({ items: [bookSummary], total: 1, page: 3, limit: 7 });
    trending.mockResolvedValue([bookSummary]);
    categories.mockResolvedValue([
      { category: 'romance', count: 12 },
      { category: 'fantasy', count: 9 },
    ]);
    mockedMakeBooksService.mockReturnValue({
      list,
      search,
      trending,
      categories,
      featured: jest.fn(),
      getById: jest.fn(),
      listChapters: jest.fn(),
      invalidateListCaches: jest.fn(),
    } as unknown as ReturnType<typeof makeBooksService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('passes /books category/status/featured/page/limit query values to the books service and returns paginated shape', async () => {
    const app = buildApp();

    const response = await app.request(
      '/books?category=romance&status=ONGOING&featured=true&page=2&limit=5',
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({
      category: 'romance',
      status: 'ONGOING',
      featured: true,
      page: 2,
      limit: 5,
    });
    await expect(response.json()).resolves.toEqual({
      items: [bookSummary],
      total: 21,
      page: 2,
      limit: 5,
    });
  });

  it('passes /books/search q/page/limit query values to the books service and returns paginated shape', async () => {
    const app = buildApp();

    const response = await app.request('/books/search?q=duke&page=3&limit=7');

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith({ q: 'duke', page: 3, limit: 7 });
    await expect(response.json()).resolves.toEqual({
      items: [bookSummary],
      total: 1,
      page: 3,
      limit: 7,
    });
  });

  it('keeps static /books/trending and /books/categories route shapes reachable before the id catch-all', async () => {
    const app = buildApp();

    const trendingResponse = await app.request('/books/trending');
    const categoriesResponse = await app.request('/books/categories');

    expect(trendingResponse.status).toBe(200);
    expect(categoriesResponse.status).toBe(200);
    expect(trending).toHaveBeenCalledTimes(1);
    expect(categories).toHaveBeenCalledTimes(1);
    await expect(trendingResponse.json()).resolves.toEqual([bookSummary]);
    await expect(categoriesResponse.json()).resolves.toEqual([
      { category: 'romance', count: 12 },
      { category: 'fantasy', count: 9 },
    ]);
  });
});
