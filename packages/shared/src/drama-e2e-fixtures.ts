const fixturePosterUrl = '/covers/pride-and-prejudice.svg';

export const dramaE2eFixtureSlug = 'the-billionaire-contract';
export const dramaE2eFreeEpisodeId = '44444444-0001-4d00-8d00-000000000001';
export const dramaE2eLockedEpisodeId = '44444444-0004-4d00-8d00-000000000004';

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
} as const;

export const dramaE2eSecondaryDrama = {
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
} as const;

export function dramaE2eFixturePlaybackUrl(episodeNumber: number): string {
  const paddedEpisodeNumber = episodeNumber < 10 ? `0${episodeNumber}` : String(episodeNumber);
  return `https://media.dramavela.test/hls/${dramaE2eFixtureDetail.slug}/episode-${paddedEpisodeNumber}.m3u8`;
}

export const dramaE2eFixtureThumbnailUrl = fixturePosterUrl;
