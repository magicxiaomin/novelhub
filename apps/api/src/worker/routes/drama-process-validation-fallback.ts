const DRAMA_ID = '66666666-6666-4666-8666-666666666666';
const MEDIA_BASE = 'https://pub-d0269fafaaac404b9b9e88602dfeaa49.r2.dev';
const REASON = 'drama_schema_unavailable';

const episodeId = (episodeNumber: number) => `66666666-6666-4666-8666-66666666660${episodeNumber}`;

const hlsUrl = (episodeNumber: number) =>
  `${MEDIA_BASE}/dramas/suspense-1913/ep${episodeNumber}/index.m3u8`;

export const isDramaProcessValidationFallbackEnabled = (env: {
  DRAMA_PROCESS_VALIDATION_FALLBACK?: string;
  PRODUCTION_DRAMA_DEMO_FALLBACK?: string;
}): boolean =>
  env.DRAMA_PROCESS_VALIDATION_FALLBACK === '1' || env.PRODUCTION_DRAMA_DEMO_FALLBACK === '1';

// Process-validation/demo-only fallback for production when the drama DB schema has not
// been migrated yet. Remove or leave disabled after the production schema is available.
const suspenseEpisodes = [1, 2, 3, 4].map((episodeNumber) => ({
  id: episodeId(episodeNumber),
  episodeId: episodeId(episodeNumber),
  dramaId: DRAMA_ID,
  episodeNumber,
  title: `Episode ${episodeNumber}`,
  synopsis: null,
  durationSeconds: 600,
  isFree: episodeNumber <= 2,
  publishedAt: '1913-07-06T00:00:00.000Z',
  isUnlocked: episodeNumber <= 2,
  progress: null,
  access: episodeNumber <= 2 ? 'granted' : 'denied',
  accessReason: episodeNumber <= 2 ? 'free' : 'locked',
  coinPerEpisode: 5,
  ...(episodeNumber <= 2 ? { hlsUrl: hlsUrl(episodeNumber), provider: 'external_hls' } : {}),
}));

const suspenseSummary = {
  id: DRAMA_ID,
  slug: 'suspense-1913',
  title: 'Suspense',
  description: 'Public-domain Suspense (1913) process-validation demo.',
  posterUrl: `${MEDIA_BASE}/dramas/suspense-1913/poster.jpg`,
  category: 'classic',
  tags: ['public-domain', 'silent-film', 'process-validation'],
  totalEpisodes: 4,
  status: 'PUBLISHED',
  isFeatured: true,
  sortOrder: 0,
  freeEpisodeCount: 2,
  coinPerEpisode: 5,
  publishedAt: '1913-07-06T00:00:00.000Z',
  processValidationFallback: true,
  reason: REASON,
};

export const makeSuspenseFallbackList = (page: number, pageSize: number) => ({
  items: [suspenseSummary],
  pageInfo: { page, pageSize, total: 1, totalPages: 1 },
  processValidationFallback: true,
  reason: REASON,
});

export const makeSuspenseFallbackDetail = (slug: string) => {
  if (slug !== 'suspense-1913') return null;
  return {
    ...suspenseSummary,
    episodes: suspenseEpisodes,
  };
};

export const makeSuspenseFallbackPlayback = (episodeIdValue: string) => {
  const episode = suspenseEpisodes.find((item) => item.episodeId === episodeIdValue);
  if (!episode) return null;
  if (episode.access !== 'granted') {
    return {
      episodeId: episode.episodeId,
      dramaId: episode.dramaId,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      durationSeconds: episode.durationSeconds,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: episode.coinPerEpisode,
      processValidationFallback: true,
      reason: REASON,
    };
  }
  return {
    episodeId: episode.episodeId,
    dramaId: episode.dramaId,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    durationSeconds: episode.durationSeconds,
    access: 'granted',
    accessReason: 'free',
    hlsUrl: episode.hlsUrl,
    provider: 'external_hls',
    processValidationFallback: true,
    reason: REASON,
  };
};
