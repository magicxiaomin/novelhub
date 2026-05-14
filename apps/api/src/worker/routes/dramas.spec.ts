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

const forbiddenPlayableMediaFields = [
  'hlsUrl',
  'playbackUrl',
  'mediaUrl',
  'signedUrl',
  'manifestUrl',
  'segmentUrl',
  'sourceFileUrl',
  'assetUrl',
  'bucket',
  'provider',
];

const forbiddenPlayableMediaValuePatterns = [
  /\.m3u8(?:\?|$)/i,
  /\.ts(?:\?|$)/i,
  /signed\.example/i,
  /cdn\.example/i,
  /private-media/i,
  /r2-bucket/i,
  /external_hls/i,
];

const expectNoPlayableMediaLeak = (value: unknown) => {
  if (typeof value === 'string') {
    for (const pattern of forbiddenPlayableMediaValuePatterns) {
      expect(value).not.toMatch(pattern);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) expectNoPlayableMediaLeak(item);
    return;
  }

  if (typeof value !== 'object' || value === null) return;

  for (const [key, nested] of Object.entries(value)) {
    expect(forbiddenPlayableMediaFields).not.toContain(key);
    expectNoPlayableMediaLeak(nested);
  }
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

const makeApp = (env: Record<string, string | undefined> = {}) => {
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
  type AppRequestArgs = Parameters<typeof app.request>;
  return {
    request: (input: AppRequestArgs[0], requestInit?: AppRequestArgs[1]) =>
      app.request(input, requestInit, env),
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

describe('dramasRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockImplementation(async (c, next) => {
      c.set('user', { id: 'user-1', email: 'reader@example.com', isAdmin: false });
      await next();
    });
  });

  it('deprecates GET /dramas when the cutoff is enabled before creating the drama service', async () => {
    const response = await makeApp().request('/dramas');

    await expectDramaDeprecated(response);
    expect(makeDramasServiceMock).not.toHaveBeenCalled();
  });

  it('deprecates GET /dramas/:slug when the cutoff is enabled before creating the drama service', async () => {
    const response = await makeApp().request('/dramas/shadow-heiress');

    await expectDramaDeprecated(response);
    expect(makeDramasServiceMock).not.toHaveBeenCalled();
  });

  it('deprecates GET /episodes/:episodeId/playback when the cutoff is enabled before creating the drama service', async () => {
    const response = await makeApp().request(
      '/episodes/11111111-1111-4111-8111-111111111111/playback',
    );

    await expectDramaDeprecated(response);
    expect(makeDramasServiceMock).not.toHaveBeenCalled();
  });

  it('deprecates POST /episodes/:episodeId/unlock when the cutoff is enabled before creating the drama service', async () => {
    const response = await makeApp().request(
      '/episodes/11111111-1111-4111-8111-111111111111/unlock',
      { method: 'POST' },
    );

    await expectDramaDeprecated(response);
    expect(makeDramasServiceMock).not.toHaveBeenCalled();
  });

  it('deprecates GET /drama-progress when the cutoff is enabled before creating the drama service', async () => {
    const response = await makeApp().request('/drama-progress');

    await expectDramaDeprecated(response);
    expect(makeDramasServiceMock).not.toHaveBeenCalled();
  });

  it('deprecates POST /drama-progress when the cutoff is enabled before creating the drama service', async () => {
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

    await expectDramaDeprecated(response);
    expect(makeDramasServiceMock).not.toHaveBeenCalled();
  });

  it('leaves GET /dramas unchanged when the drama cutoff is disabled (rollback)', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [contractDramaSummary],
      pageInfo: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1', PRODUCT_MODE: 'mixed' }).request(
      '/dramas',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-novelhub-deprecated')).toBeNull();
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('serves GET /dramas without an /api prefix and forwards validated pagination filters', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [contractDramaSummary],
      pageInfo: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
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

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
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

  it('strips playable media fields from denied playback responses', async () => {
    const getPlayback = jest.fn().mockResolvedValue({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: 5,
      hlsUrl: 'https://cdn.example/drama/episode-2.m3u8',
      playbackUrl: 'https://signed.example/episode-2.m3u8?token=***',
      provider: 'external_hls',
      sourceFileUrl: 'https://r2-bucket.example/source-file.mp4',
      assetUrl: 'https://cdn.example/drama/episode-2.ts',
      videoAsset: {
        bucket: 'private-media',
        manifestUrl: 'https://cdn.example/manifest.m3u8',
        segmentUrl: 'https://cdn.example/segment-0001.ts',
        renamedPlayableUrl: 'https://signed.example/renamed.m3u8',
      },
    });
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/episodes/11111111-1111-4111-8111-111111111111/playback',
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: 5,
    });
    expectNoPlayableMediaLeak(body);
  });

  it('fails closed for unknown non-granted playback access states', async () => {
    const getPlayback = jest.fn().mockResolvedValue({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      access: 'pending_review',
      sourceFileUrl: 'https://r2-bucket.example/source-file.mp4',
      assetUrl: 'https://cdn.example/drama/episode-2.ts',
      renamedPlayableUrl: 'https://signed.example/renamed.m3u8',
      videoAsset: {
        provider: 'external_hls',
        bucket: 'private-media',
        manifestUrl: 'https://cdn.example/manifest.m3u8',
      },
    });
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/episodes/11111111-1111-4111-8111-111111111111/playback',
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      access: 'pending_review',
    });
    expectNoPlayableMediaLeak(body);
  });

  it('keeps playable HLS URL for granted free playback responses', async () => {
    const getPlayback = jest.fn().mockResolvedValue({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 1,
      title: 'The Trap',
      durationSeconds: 60,
      access: 'granted',
      accessReason: 'free',
      hlsUrl: 'https://cdn.example/drama/episode-1.m3u8',
      provider: 'external_hls',
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
    });
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/episodes/11111111-1111-4111-8111-111111111111/playback',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      episodeId: '11111111-1111-4111-8111-111111111111',
      dramaId: 'drama-1',
      episodeNumber: 1,
      title: 'The Trap',
      durationSeconds: 60,
      access: 'granted',
      accessReason: 'free',
      hlsUrl: 'https://cdn.example/drama/episode-1.m3u8',
      provider: 'external_hls',
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
    });
  });

  it('rejects invalid playback episode ids before calling the service', async () => {
    const getPlayback = jest.fn();
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/episodes/not-a-uuid/playback',
    );

    expect(response.status).toBe(400);
    expect(getPlayback).not.toHaveBeenCalled();
  });

  it('serves GET /dramas/:slug with ordered episode contract metadata', async () => {
    const getBySlug = jest.fn().mockResolvedValue(contractDramaDetail);
    makeDramasServiceMock.mockReturnValue({ getBySlug } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/dramas/shadow-heiress',
    );

    expect(response.status).toBe(200);
    expect(getBySlug).toHaveBeenCalledWith('shadow-heiress', null);
    await expect(response.json()).resolves.toEqual(contractDramaDetail);
  });

  it('strips playable media fields from locked detail episode responses', async () => {
    const getBySlug = jest.fn().mockResolvedValue({
      ...contractDramaDetail,
      episodes: [
        {
          ...contractDramaDetail.episodes[0],
          isUnlocked: true,
          hlsUrl: 'https://cdn.example/drama/free.m3u8',
          provider: 'external_hls',
        },
        {
          ...contractDramaDetail.episodes[1],
          isUnlocked: false,
          hlsUrl: 'https://cdn.example/drama/locked.m3u8',
          playbackUrl: 'https://signed.example/locked.m3u8?token=***',
          provider: 'external_hls',
          sourceFileUrl: 'https://r2-bucket.example/source-file.mp4',
          assetUrl: 'https://cdn.example/drama/locked.ts',
          videoAsset: {
            bucket: 'private-media',
            signedUrl: 'https://signed.example/private.m3u8',
            renamedPlayableUrl: 'https://signed.example/renamed.m3u8',
          },
        },
      ],
    });
    makeDramasServiceMock.mockReturnValue({ getBySlug } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/dramas/shadow-heiress',
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { episodes: Array<Record<string, unknown>> };
    expect(body.episodes[0]).toMatchObject({
      hlsUrl: 'https://cdn.example/drama/free.m3u8',
      provider: 'external_hls',
    });
    expect(body.episodes[1]).toEqual(contractDramaDetail.episodes[1]);
    expectNoPlayableMediaLeak(body.episodes[1]);
  });

  it('strips playable media fields from locked list episode responses', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [
        {
          ...contractDramaSummary,
          episodes: [
            {
              id: 'episode-2',
              isUnlocked: false,
              playbackUrl: 'https://signed.example/locked.m3u8?token=***',
              provider: 'external_hls',
              sourceFileUrl: 'https://r2-bucket.example/source-file.mp4',
              assetUrl: 'https://cdn.example/drama/locked.ts',
              renamedPlayableUrl: 'https://signed.example/renamed.m3u8',
            },
          ],
        },
      ],
      pageInfo: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request('/dramas');

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ episodes: Array<Record<string, unknown>> }>;
    };
    const lockedEpisode = body.items[0]?.episodes[0];
    expect(lockedEpisode).toEqual({ id: 'episode-2', isUnlocked: false });
    expectNoPlayableMediaLeak(lockedEpisode);
  });

  it('returns disabled list semantics instead of 500 when the drama table is not deployed', async () => {
    const list = jest
      .fn()
      .mockRejectedValue({ code: 'P2021', message: 'Table `dramas` does not exist' });
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/dramas?page=2&pageSize=10',
    );

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

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/dramas/shadow-heiress',
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      statusCode: 404,
      message: 'Drama catalog is temporarily unavailable',
      error: 'Not Found',
      disabled: true,
      reason: 'drama_schema_unavailable',
    });
  });

  it('serves flag-gated Suspense demo list fallback when the drama table is not deployed', async () => {
    const list = jest
      .fn()
      .mockRejectedValue({ code: 'P2021', message: 'Table `dramas` does not exist' });
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp({
      DRAMA_CUTOFF_DISABLED: '1',
      DRAMA_PROCESS_VALIDATION_FALLBACK: '1',
    }).request('/dramas');

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      processValidationFallback: true,
      reason: 'drama_schema_unavailable',
      items: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          slug: 'suspense-1913',
          title: 'Suspense',
          totalEpisodes: 4,
          freeEpisodeCount: 2,
        },
      ],
      pageInfo: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
  });

  it('serves flag-gated Suspense demo detail fallback with locked episodes sanitized', async () => {
    const getBySlug = jest
      .fn()
      .mockRejectedValue({ code: 'P2022', message: 'Column `dramas.deleted_at` does not exist' });
    makeDramasServiceMock.mockReturnValue({ getBySlug } as never);

    const response = await makeApp({
      DRAMA_CUTOFF_DISABLED: '1',
      DRAMA_PROCESS_VALIDATION_FALLBACK: '1',
    }).request('/dramas/suspense-1913');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { episodes: Array<Record<string, unknown>> };
    expect(body).toMatchObject({
      id: '66666666-6666-4666-8666-666666666666',
      slug: 'suspense-1913',
      processValidationFallback: true,
      reason: 'drama_schema_unavailable',
    });
    expect(body.episodes).toHaveLength(4);
    expect(body.episodes[0]).toMatchObject({
      id: '66666666-0001-4d00-8d00-000000000001',
      episodeId: '66666666-0001-4d00-8d00-000000000001',
      episodeNumber: 1,
      isFree: true,
      isUnlocked: true,
    });
    expect(body.episodes[1]).toMatchObject({
      id: '66666666-0002-4d00-8d00-000000000002',
      episodeId: '66666666-0002-4d00-8d00-000000000002',
      episodeNumber: 2,
      isFree: true,
      isUnlocked: true,
    });
    expect(body.episodes[2]).toMatchObject({
      id: '66666666-0003-4d00-8d00-000000000003',
      episodeId: '66666666-0003-4d00-8d00-000000000003',
      episodeNumber: 3,
      isFree: false,
      isUnlocked: false,
    });
    expectNoPlayableMediaLeak(body.episodes[2]);
    expectNoPlayableMediaLeak(body.episodes[3]);
  });

  it('serves flag-gated Suspense demo free playback fallback when the drama table is not deployed', async () => {
    const getPlayback = jest
      .fn()
      .mockRejectedValue({ code: 'P2021', message: 'Table `dramas` does not exist' });
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp({
      DRAMA_CUTOFF_DISABLED: '1',
      DRAMA_PROCESS_VALIDATION_FALLBACK: '1',
    }).request('/episodes/66666666-0001-4d00-8d00-000000000001/playback');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      episodeId: '66666666-0001-4d00-8d00-000000000001',
      dramaId: '66666666-6666-4666-8666-666666666666',
      episodeNumber: 1,
      access: 'granted',
      accessReason: 'free',
      hlsUrl:
        'https://pub-d0269fafaaac404b9b9e88602dfeaa49.r2.dev/dramas/suspense-1913/ep1/index.m3u8',
      processValidationFallback: true,
      reason: 'drama_schema_unavailable',
    });
  });

  it('serves flag-gated Suspense demo locked playback fallback without leaking HLS', async () => {
    const getPlayback = jest
      .fn()
      .mockRejectedValue({ code: 'P2021', message: 'Table `dramas` does not exist' });
    makeDramasServiceMock.mockReturnValue({ getPlayback } as never);

    const response = await makeApp({
      DRAMA_CUTOFF_DISABLED: '1',
      DRAMA_PROCESS_VALIDATION_FALLBACK: '1',
    }).request('/episodes/66666666-0003-4d00-8d00-000000000003/playback');

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      episodeId: '66666666-0003-4d00-8d00-000000000003',
      dramaId: '66666666-6666-4666-8666-666666666666',
      episodeNumber: 3,
      title: 'Episode 3',
      durationSeconds: 600,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: 5,
      processValidationFallback: true,
      reason: 'drama_schema_unavailable',
    });
    expectNoPlayableMediaLeak(body);
  });

  it('rejects invalid list query parameters before calling the service', async () => {
    const list = jest.fn();
    makeDramasServiceMock.mockReturnValue({ list } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/dramas?page=0&pageSize=99&featured=yes',
    );

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('rejects invalid unlock episode ids before calling the service', async () => {
    const unlockEpisode = jest.fn();
    makeDramasServiceMock.mockReturnValue({ unlockEpisode } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
      '/episodes/not-a-uuid/unlock',
      { method: 'POST' },
    );

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

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request(
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

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request('/drama-progress', {
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

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request('/drama-progress', {
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

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request('/drama-progress');

    expect(response.status).toBe(200);
    expect(listContinueWatching).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toEqual(continueWatching);
  });

  it('rejects invalid POST /drama-progress payloads before calling the service', async () => {
    const saveProgress = jest.fn();
    makeDramasServiceMock.mockReturnValue({ saveProgress } as never);

    const response = await makeApp({ DRAMA_CUTOFF_DISABLED: '1' }).request('/drama-progress', {
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
