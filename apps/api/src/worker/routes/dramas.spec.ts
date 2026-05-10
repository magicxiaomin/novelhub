import { Hono } from 'hono';

import { DomainError } from '../../common/domain.errors';
import { dramasRoutes } from './dramas';
import { makeDramasService } from '../services/dramas-factory';

jest.mock('../services/dramas-factory', () => ({
  makeDramasService: jest.fn(),
}));

const makeDramasServiceMock = jest.mocked(makeDramasService);

const contractDramaSummary = {
  id: 'drama-1',
  slug: 'shadow-heiress',
  title: 'Shadow Heiress',
  description: 'A revenge short drama.',
  posterUrl: 'https://cdn.example/poster.jpg',
  category: 'revenge',
  tags: ['revenge', 'billionaire'],
  totalEpisodes: 3,
  status: 'PUBLISHED',
  isFeatured: true,
  sortOrder: 1,
  freeEpisodeCount: 1,
  coinPerEpisode: 5,
  publishedAt: '2026-05-10T12:00:00.000Z',
};

const contractDramaDetail = {
  ...contractDramaSummary,
  episodes: [
    {
      id: 'episode-1',
      episodeNumber: 1,
      title: 'The Trap',
      synopsis: 'Pilot',
      durationSeconds: 60,
      isFree: true,
      publishedAt: '2026-05-10T12:00:00.000Z',
      isUnlocked: true,
      progress: null,
    },
    {
      id: 'episode-2',
      episodeNumber: 2,
      title: 'The Escape',
      synopsis: null,
      durationSeconds: 70,
      isFree: false,
      publishedAt: '2026-05-10T12:00:00.000Z',
      isUnlocked: false,
      progress: null,
    },
  ],
};

const makeApp = () => {
  const app = new Hono<{
    Bindings: Record<string, string | undefined>;
    Variables: { prisma: unknown; user?: { id: string; email: string; isAdmin: boolean } };
  }>();
  app.use('/dramas/*', async (c, next) => {
    c.set('prisma', { user: { findUnique: jest.fn() } });
    await next();
  });
  app.route('/dramas', dramasRoutes);
  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        { statusCode: err.status, message: err.message, error: 'Bad Request' },
        err.status,
      );
    }
    throw err;
  });
  return app;
};

describe('dramasRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves GET /dramas without an /api prefix and forwards validated pagination filters', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [contractDramaSummary],
      pageInfo: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp().request(
      '/dramas?page=2&pageSize=10&category=revenge&featured=true',
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      category: 'revenge',
      featured: true,
    });
    await expect(response.json()).resolves.toEqual({
      items: [contractDramaSummary],
      pageInfo: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it('serves GET /dramas/:slug with ordered episode contract metadata', async () => {
    const getBySlug = jest.fn().mockResolvedValue(contractDramaDetail);
    makeDramasServiceMock.mockReturnValue({ getBySlug } as never);

    const response = await makeApp().request('/dramas/shadow-heiress');

    expect(response.status).toBe(200);
    expect(getBySlug).toHaveBeenCalledWith('shadow-heiress', null);
    await expect(response.json()).resolves.toEqual(contractDramaDetail);
  });

  it('rejects invalid list query parameters before calling the service', async () => {
    const list = jest.fn();
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp().request('/dramas?page=0&pageSize=99&featured=yes');

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
});
