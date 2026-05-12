export const dramaE2eFixtureSlug = 'the-billionaire-contract';
export const dramaE2eFreeEpisodeId = '44444444-0001-4d00-8d00-000000000001';
export const dramaE2eLockedEpisodeId = '44444444-0004-4d00-8d00-000000000004';

const fixturePosterUrl = '/covers/pride-and-prejudice.svg';

export const dramaE2eFixtureDetail = {
  id: '33333333-0000-4d00-8d00-000000000000',
  slug: dramaE2eFixtureSlug,
  title: 'The Billionaire Contract',
  description:
    'A deterministic web E2E fixture for validating HLS playback and the locked episode paywall without live staging data changes.',
  posterUrl: fixturePosterUrl,
  category: 'Romance',
  tags: ['Contract Marriage', 'Billionaire', 'Revenge'],
  totalEpisodes: 4,
  status: 'ONGOING',
  isFeatured: true,
  sortOrder: 1,
  freeEpisodeCount: 3,
  coinPerEpisode: 25,
  publishedAt: '2026-01-01T00:00:00.000Z',
  episodes: [
    {
      id: dramaE2eFreeEpisodeId,
      episodeNumber: 1,
      title: 'The Offer',
      synopsis: 'A contract marriage offer changes everything.',
      durationSeconds: 80,
      isFree: true,
      publishedAt: '2026-01-01T00:00:00.000Z',
      isUnlocked: true,
      progress: {
        positionSeconds: 37,
        durationSeconds: 80,
        completedAt: null,
        lastWatchedAt: '2026-01-10T00:00:00.000Z',
      },
    },
    {
      id: '44444444-0002-4d00-8d00-000000000002',
      episodeNumber: 2,
      title: 'Terms and Conditions',
      synopsis: 'The deal gets complicated.',
      durationSeconds: 83,
      isFree: true,
      publishedAt: '2026-01-02T00:00:00.000Z',
      isUnlocked: true,
      progress: null,
    },
    {
      id: '44444444-0003-4d00-8d00-000000000003',
      episodeNumber: 3,
      title: 'A Public Kiss',
      synopsis: 'The fake romance goes public.',
      durationSeconds: 87,
      isFree: true,
      publishedAt: '2026-01-03T00:00:00.000Z',
      isUnlocked: true,
      progress: null,
    },
    {
      id: dramaE2eLockedEpisodeId,
      episodeNumber: 4,
      title: 'The Locked Penthouse',
      synopsis: 'The first premium cliffhanger stays behind the paywall.',
      durationSeconds: 92,
      isFree: false,
      publishedAt: '2026-01-04T00:00:00.000Z',
      isUnlocked: false,
      progress: null,
    },
  ],
};

const secondaryDrama = {
  id: '33333333-0000-4d00-8d00-000000000001',
  slug: 'revenge-in-red-heels',
  title: 'Revenge in Red Heels',
  description: 'A second fixture card keeps browse navigation representative of staging lists.',
  posterUrl: fixturePosterUrl,
  category: 'Revenge',
  tags: ['Revenge', 'Fashion'],
  totalEpisodes: 6,
  status: 'ONGOING',
  isFeatured: true,
  sortOrder: 2,
  freeEpisodeCount: 2,
  coinPerEpisode: 25,
  publishedAt: '2026-01-05T00:00:00.000Z',
};

export function dramaE2eFixtureList() {
  return {
    items: [toSummary(dramaE2eFixtureDetail), secondaryDrama],
    pageInfo: {
      page: 1,
      pageSize: 24,
      total: 2,
      totalPages: 1,
    },
  };
}

export function dramaE2eFixturePlayback(episodeId: string) {
  const episode = dramaE2eFixtureDetail.episodes.find((item) => item.id === episodeId);
  if (!episode) return null;

  if (!episode.isFree && !episode.isUnlocked) {
    return {
      episodeId: episode.id,
      dramaId: dramaE2eFixtureDetail.id,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      durationSeconds: episode.durationSeconds,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: dramaE2eFixtureDetail.coinPerEpisode,
    };
  }

  return {
    episodeId: episode.id,
    dramaId: dramaE2eFixtureDetail.id,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    durationSeconds: episode.durationSeconds,
    access: 'granted',
    accessReason: 'free',
    hlsUrl: `https://media.dramavela.test/hls/${dramaE2eFixtureDetail.slug}/episode-${String(
      episode.episodeNumber,
    ).padStart(2, '0')}.m3u8`,
    provider: 'e2e-fixture-hls',
    thumbnailUrl: fixturePosterUrl,
  };
}

function toSummary(detail: typeof dramaE2eFixtureDetail) {
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    description: detail.description,
    posterUrl: detail.posterUrl,
    category: detail.category,
    tags: detail.tags,
    totalEpisodes: detail.totalEpisodes,
    status: detail.status,
    isFeatured: detail.isFeatured,
    sortOrder: detail.sortOrder,
    freeEpisodeCount: detail.freeEpisodeCount,
    coinPerEpisode: detail.coinPerEpisode,
    publishedAt: detail.publishedAt,
  };
}
