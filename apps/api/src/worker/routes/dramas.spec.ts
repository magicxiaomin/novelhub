import { Hono } from 'hono';

import { DomainError } from '../../common/domain.errors';
import { dramaProgressRoutes } from './drama-progress';
import { dramasRoutes } from './dramas';
import { episodesRoutes } from './episodes';
import { makeDramasService } from '../services/dramas-factory';

jest.mock('../services/dramas-factory', () => ({
  makeDramasService: jest.fn(),
}));

// Jest hoists mock factories before const/let initialization; var avoids TDZ here.
// eslint-disable-next-line no-var
var mockRequireAuth: jest.Mock;

jest.mock('../middleware/auth', () => {
  mockRequireAuth = jest.fn(async (c, next) => {
    c.set('user', { id: 'user-1', email: 'reader@example.com', isAdmin: false });
    await next();
  });
  return {
    optionalAuth: jest.fn(async (_c, next) => next()),
    requireAuth: mockRequireAuth,
  };
});

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
  app.use('/drama-progress/*', async (c, next) => {
    c.set('prisma', { user: { findUnique: jest.fn() } });
    await next();
  });
  app.use('/dramas/*', async (c, next) => {
    c.set('prisma', { user: { findUnique: jest.fn() } });
    await next();
  });
  app.use('/episodes/*', async (c, next) => {
    c.set('prisma', { user: { findUnique: jest.fn() } });
    await next();
  });
  app.route('/drama-progress', dramaProgressRoutes);
  app.route('/dramas', dramasRoutes);
  app.route('/episodes', episodesRoutes);
  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        {
          statusCode: err.status,
          message: err.message,
          error: err.status === 404 ? 'Not Found' : 'Bad Request',
          ...(err.context ?? {}),
        },
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
    mockRequireAuth.mockImplementation(async (c, next) => {
      c.set('user', { id: 'user-1', email: 'reader@example.com', isAdmin: false });
      await next();
    });
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

  it('serves GET /episodes/:episodeId/playback and does not wrap denied paywall response', async () => {
    const getPlayback = jest.fn().mockResolvedValue({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: 5,
    });
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp().request(
      '/episodes/11111111-1111-4111-8111-111111111111/playback',
    );

    expect(response.status).toBe(200);
    expect(getPlayback).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', null);
    await expect(response.json()).resolves.toEqual({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: 5,
    });
  });

  it('rejects invalid playback episode ids before calling the service', async () => {
    const getPlayback = jest.fn();
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp().request('/episodes/not-a-uuid/playback');

    expect(response.status).toBe(400);
    expect(getPlayback).not.toHaveBeenCalled();
  });

  it('serves GET /dramas/:slug with ordered episode contract metadata', async () => {
    const getBySlug = jest.fn().mockResolvedValue(contractDramaDetail);
    makeDramasServiceMock.mockReturnValue({ getBySlug } as never);

    const response = await makeApp().request('/dramas/shadow-heiress');

    expect(response.status).toBe(200);
    expect(getBySlug).toHaveBeenCalledWith('shadow-heiress', null);
    await expect(response.json()).resolves.toEqual(contractDramaDetail);
  });

  it('returns disabled list semantics instead of 500 when the drama table is not deployed', async () => {
    const list = jest
      .fn()
      .mockRejectedValue({ code: 'P2021', message: 'Table `dramas` does not exist' });
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp().request('/dramas?page=2&pageSize=10');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [],
      pageInfo: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
      disabled: true,
      reason: 'drama_schema_unavailable',
    });
  });

  it('returns disabled detail semantics instead of 500 when the drama table is not deployed', async () => {
    const getBySlug = jest
      .fn()
      .mockRejectedValue({ code: 'P2022', message: 'Column `dramas.deleted_at` does not exist' });
    makeDramasServiceMock.mockReturnValue({ getBySlug } as never);

    const response = await makeApp().request('/dramas/shadow-heiress');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      statusCode: 404,
      message: 'Drama catalog is temporarily unavailable',
      error: 'Not Found',
      disabled: true,
      reason: 'drama_schema_unavailable',
    });
  });

  it('rejects invalid list query parameters before calling the service', async () => {
    const list = jest.fn();
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp().request('/dramas?page=0&pageSize=99&featured=yes');

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('rejects invalid unlock episode ids before calling the service', async () => {
    const unlockEpisode = jest.fn();
    makeDramasServiceMock.mockReturnValue({ unlockEpisode } as never);

    const response = await makeApp().request('/episodes/not-a-uuid/unlock', { method: 'POST' });

    expect(response.status).toBe(400);
    expect(unlockEpisode).not.toHaveBeenCalled();
  });

  it('serves POST /episodes/:episodeId/unlock for authenticated users', async () => {
    const unlockEpisode = jest.fn().mockResolvedValue({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      access: 'granted',
      accessReason: 'unlocked',
      unlockId: 'unlock-1',
      method: 'COINS',
      coinCost: 5,
      balanceAfter: 15,
      transactionId: 'txn-1',
      unlockedAt: '2026-05-10T12:00:00.000Z',
    });
    makeDramasServiceMock.mockReturnValue({ unlockEpisode } as never);

    const response = await makeApp().request(
      '/episodes/11111111-1111-4111-8111-111111111111/unlock',
      { method: 'POST' },
    );

    expect(response.status).toBe(201);
    expect(unlockEpisode).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'user-1');
    await expect(response.json()).resolves.toEqual({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      access: 'granted',
      accessReason: 'unlocked',
      unlockId: 'unlock-1',
      method: 'COINS',
      coinCost: 5,
      balanceAfter: 15,
      transactionId: 'txn-1',
      unlockedAt: '2026-05-10T12:00:00.000Z',
    });
  });

  it('rejects unauthenticated POST /drama-progress before calling the service', async () => {
    const saveProgress = jest.fn();
    makeDramasServiceMock.mockReturnValue({ saveProgress } as never);
    mockRequireAuth.mockImplementation(async (c) => c.json({ message: 'Unauthorized' }, 401));

    const response = await makeApp().request('/drama-progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        episodeId: '11111111-1111-4111-8111-111111111111',
        positionSeconds: 42,
        durationSeconds: 60,
        completed: false,
      }),
    });

    expect(response.status).toBe(401);
    expect(saveProgress).not.toHaveBeenCalled();
  });

  it('serves authenticated POST /drama-progress and forwards userId plus validated body', async () => {
    const savedProgress = {
      episodeId: '11111111-1111-4111-8111-111111111111',
      positionSeconds: 42,
      durationSeconds: 60,
      completed: false,
      updatedAt: '2026-05-10T12:00:00.000Z',
    };
    const saveProgress = jest.fn().mockResolvedValue(savedProgress);
    makeDramasServiceMock.mockReturnValue({ saveProgress } as never);

    const response = await makeApp().request('/drama-progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        episodeId: '11111111-1111-4111-8111-111111111111',
        positionSeconds: 42,
        durationSeconds: 60,
        completed: false,
      }),
    });

    expect(response.status).toBe(200);
    expect(saveProgress).toHaveBeenCalledWith('user-1', {
      episodeId: '11111111-1111-4111-8111-111111111111',
      positionSeconds: 42,
      durationSeconds: 60,
      completed: false,
    });
    await expect(response.json()).resolves.toEqual(savedProgress);
  });

  it('serves authenticated GET /drama-progress and forwards userId', async () => {
    const continueWatching = [
      {
        dramaId: 'drama-1',
        dramaSlug: 'shadow-heiress',
        episodeId: '11111111-1111-4111-8111-111111111111',
        episodeNumber: 1,
        positionSeconds: 42,
        durationSeconds: 60,
        updatedAt: '2026-05-10T12:00:00.000Z',
      },
    ];
    const listContinueWatching = jest.fn().mockResolvedValue(continueWatching);
    makeDramasServiceMock.mockReturnValue({ listContinueWatching } as never);

    const response = await makeApp().request('/drama-progress');

    expect(response.status).toBe(200);
    expect(listContinueWatching).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toEqual(continueWatching);
  });

  it('rejects invalid POST /drama-progress payloads before calling the service', async () => {
    const saveProgress = jest.fn();
    makeDramasServiceMock.mockReturnValue({ saveProgress } as never);

    const response = await makeApp().request('/drama-progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        episodeId: 'not-a-uuid',
        positionSeconds: -1,
        completed: 'no',
      }),
    });

    expect(response.status).toBe(400);
    expect(saveProgress).not.toHaveBeenCalled();
  });
});
