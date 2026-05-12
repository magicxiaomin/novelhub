import {
  dramaE2eFixtureDetail as sharedDramaE2eFixtureDetail,
  dramaE2eFixturePlaybackUrl,
  dramaE2eFixtureThumbnailUrl,
  dramaE2eFreeEpisodeId,
  dramaE2eLockedEpisodeId,
  dramaE2eSecondaryDrama,
  dramaE2eFixtureSlug,
} from '@novelhub/shared';
import type { DramaDetail, DramaPaginated, DramaSummary, EpisodePlayback } from './types';

export { dramaE2eFixtureSlug, dramaE2eFreeEpisodeId, dramaE2eLockedEpisodeId };

export const dramaE2eFixtureDetail = sharedDramaE2eFixtureDetail as unknown as DramaDetail;

const secondaryDrama = dramaE2eSecondaryDrama as unknown as DramaSummary;

export function dramaE2eFixtureList(): DramaPaginated<DramaSummary> {
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

export function dramaE2eFixturePlayback(episodeId: string): EpisodePlayback | null {
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
    hlsUrl: dramaE2eFixturePlaybackUrl(episode.episodeNumber),
    provider: 'e2e-fixture-hls',
    thumbnailUrl: dramaE2eFixtureThumbnailUrl,
  };
}

function toSummary(detail: DramaDetail): DramaSummary {
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
