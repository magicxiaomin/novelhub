export {
  dramaE2eFixtureDetail,
  dramaE2eFixturePlaybackUrl,
  dramaE2eFixtureSlug,
  dramaE2eFreeEpisodeId,
  dramaE2eLockedEpisodeId,
} from '@novelhub/shared';
import {
  dramaE2eFixtureDetail,
  dramaE2eFixturePlaybackUrl,
  dramaE2eSecondaryDrama,
  dramaE2eFixtureThumbnailUrl,
} from '@novelhub/shared';

export function dramaE2eFixtureList() {
  return {
    items: [toSummary(dramaE2eFixtureDetail), dramaE2eSecondaryDrama],
    pageInfo: {
      page: 1,
      pageSize: 24,
      total: 2,
      totalPages: 1,
    },
  };
}

export function dramaE2eFixturePlayback(episodeId: string) {
  let episode: (typeof dramaE2eFixtureDetail.episodes)[number] | undefined;
  for (const candidate of dramaE2eFixtureDetail.episodes) {
    if (candidate.id === episodeId) {
      episode = candidate;
      break;
    }
  }
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
    hlsUrl: dramaE2eFixturePlaybackUrl(episode.episodeNumber),
    provider: 'e2e-fixture-hls',
    thumbnailUrl: dramaE2eFixtureThumbnailUrl,
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
