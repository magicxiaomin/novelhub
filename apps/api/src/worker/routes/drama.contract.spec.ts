import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeDramasService } from '../services/dramas-factory';
import type { WorkerEnv } from '../services/auth-factory';
import { dramaProgressRoutes } from './drama-progress';
import { dramasRoutes } from './dramas';
import { episodesRoutes } from './episodes';

jest.mock('../services/dramas-factory', () => ({
  makeDramasService: jest.fn(),
}));

// Contract tests focus on public route shape, not token parsing.
jest.mock('../middleware/auth', () => ({
  optionalAuth: jest.fn(async (_c, next) => next()),
  requireAuth: jest.fn(async (c, next) => {
    c.set('user', { id: 'user-1', email: 'reader@example.com', isAdmin: false });
    await next();
  }),
}));

const mockedMakeDramasService = jest.mocked(makeDramasService);

const dramaSummary = {
  id: 'drama-1',
  slug: 'shadow-heiress',
  title: 'Shadow Heiress',
  description: 'A revenge short drama.',
  posterUrl: 'https://cdn.example/poster.jpg',
  category: 'revenge',
  tags: ['revenge'],
  totalEpisodes: 1,
  status: 'PUBLISHED',
  isFeatured: true,
  sortOrder: 1,
  freeEpisodeCount: 1,
  coinPerEpisode: 5,
  publishedAt: '2026-05-10T12:00:00.000Z',
};

const buildApp = (env: Partial<WorkerEnv> = {}) => {
  const app = new Hono<{
    Bindings: WorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();
  app.use('*', async (c, next) => {
    c.set('prisma', {} as PrismaVariables['prisma']);
    await next();
  });
  app.route('/dramas', dramasRoutes);
  app.route('/episodes', episodesRoutes);
  app.route('/drama-progress', dramaProgressRoutes);

  type AppRequestArgs = Parameters<typeof app.request>;
  return {
    request: (input: AppRequestArgs[0], requestInit?: AppRequestArgs[1]) =>
      app.request(input, requestInit, env as WorkerEnv),
  };
};

const expectDramaDeprecated = async (response: Response) => {
  expect(response.status).toBe(410);
  expect(response.headers.get('x-novelhub-deprecated')).toBe('drama');
  await expect(response.json()).resolves.toEqual({
    code: 'DRAMA_DEPRECATED',
    message: 'Short-drama endpoints are deprecated during the novels-only pivot.',
  });
};

describe('Worker drama route product-mode contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deprecates public drama endpoints when the cutoff is enabled before constructing the drama service', async () => {
    const app = buildApp();

    await expectDramaDeprecated(await app.request('/dramas'));
    await expectDramaDeprecated(await app.request('/dramas/shadow-heiress'));
    await expectDramaDeprecated(
      await app.request('/episodes/11111111-1111-4111-8111-111111111111/playback'),
    );
    await expectDramaDeprecated(
      await app.request('/episodes/11111111-1111-4111-8111-111111111111/unlock', {
        method: 'POST',
      }),
    );
    await expectDramaDeprecated(await app.request('/drama-progress'));
    await expectDramaDeprecated(
      await app.request('/drama-progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          episodeId: '11111111-1111-4111-8111-111111111111',
          positionSeconds: 42,
          durationSeconds: 60,
          completed: false,
        }),
      }),
    );

    expect(mockedMakeDramasService).not.toHaveBeenCalled();
  });

  it('leaves the public drama list contract unchanged when the drama cutoff is disabled (rollback)', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [dramaSummary],
      pageInfo: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    mockedMakeDramasService.mockReturnValue({ list } as never);

    const response = await buildApp({ DRAMA_CUTOFF_DISABLED: '1', PRODUCT_MODE: 'mixed' }).request(
      '/dramas',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-novelhub-deprecated')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ items: [dramaSummary] });
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
});
