import type { Prisma, PrismaClient } from '@prisma/client';

import { DomainError } from '../../common/domain.errors';
import { SUBSCRIPTION_ACTIVE_STATUSES } from '../auth/auth.constants';
import type {
  ContinueWatching,
  DramaDetail,
  DramaSummary,
  EpisodePlayback,
  EpisodePlaybackGranted,
  EpisodeProgress,
  EpisodeSummary,
  ListDramasQuery,
  Paginated,
  SaveWatchProgressInput,
  WatchProgress,
} from './dramas.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const PUBLISHED = 'PUBLISHED';

export type DramasServiceDeps = {
  prisma: PrismaClient;
};

const toIso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

type DramaRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  posterUrl: string;
  category: string;
  tags: string[];
  totalEpisodes: number;
  status: string;
  isFeatured: boolean;
  sortOrder: number;
  freeEpisodeCount: number;
  coinPerEpisode: number;
  publishedAt: Date | null;
};

const toDramaSummary = (drama: DramaRow): DramaSummary => ({
  id: drama.id,
  slug: drama.slug,
  title: drama.title,
  description: drama.description,
  posterUrl: drama.posterUrl,
  category: drama.category,
  tags: drama.tags,
  totalEpisodes: drama.totalEpisodes,
  status: drama.status,
  isFeatured: drama.isFeatured,
  sortOrder: drama.sortOrder,
  freeEpisodeCount: drama.freeEpisodeCount,
  coinPerEpisode: drama.coinPerEpisode,
  publishedAt: toIso(drama.publishedAt),
});

const toWatchProgress = (p: {
  episodeId: string;
  dramaId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  completedAt: Date | null;
  lastWatchedAt: Date;
}): WatchProgress => ({
  episodeId: p.episodeId,
  dramaId: p.dramaId,
  positionSeconds: p.positionSeconds,
  durationSeconds: p.durationSeconds,
  completedAt: toIso(p.completedAt),
  lastWatchedAt: p.lastWatchedAt.toISOString(),
});

// `publishedAt <= now OR null` — the schema permits a published drama with a
// null `publishedAt` (admin marked it PUBLISHED without scheduling), so we
// surface those in the list rather than hiding them behind a date check that
// would misread null as "unscheduled future."
const publishedAtVisible = (now: Date): Prisma.DramaWhereInput[] => [
  { publishedAt: null },
  { publishedAt: { lte: now } },
];

export class DramasService {
  private readonly prisma: PrismaClient;

  constructor(deps: DramasServiceDeps) {
    this.prisma = deps.prisma;
  }

  async list(query: ListDramasQuery): Promise<Paginated<DramaSummary>> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const now = new Date();

    const where: Prisma.DramaWhereInput = {
      status: PUBLISHED,
      deletedAt: null,
      OR: publishedAtVisible(now),
    };
    if (query.category) where.category = query.category;
    if (typeof query.featured === 'boolean') where.isFeatured = query.featured;

    const [items, total] = await Promise.all([
      this.prisma.drama.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.drama.count({ where }),
    ]);

    return {
      items: items.map(toDramaSummary),
      pageInfo: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  private toPlaybackGranted(
    episode: {
      id: string;
      dramaId: string;
      episodeNumber: number;
      title: string;
      durationSeconds: number | null;
      videoAsset: { playbackUrl: string; provider: string; thumbnailUrl: string | null };
    },
    accessReason: EpisodePlaybackGranted['accessReason'],
  ): EpisodePlaybackGranted {
    return {
      episodeId: episode.id,
      dramaId: episode.dramaId,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      durationSeconds: episode.durationSeconds,
      access: 'granted',
      accessReason,
      hlsUrl: episode.videoAsset.playbackUrl,
      provider: episode.videoAsset.provider,
      thumbnailUrl: episode.videoAsset.thumbnailUrl,
    };
  }

  async getPlayback(episodeId: string, userId: string | null): Promise<EpisodePlayback> {
    const now = new Date();
    const episode = await this.prisma.episode.findFirst({
      where: {
        id: episodeId,
        isPublished: true,
        deletedAt: null,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        drama: {
          status: PUBLISHED,
          deletedAt: null,
          OR: publishedAtVisible(now),
        },
      },
      select: {
        id: true,
        dramaId: true,
        episodeNumber: true,
        title: true,
        durationSeconds: true,
        isFree: true,
        drama: { select: { coinPerEpisode: true } },
        videoAsset: {
          select: {
            playbackUrl: true,
            provider: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    if (!episode) {
      throw DomainError.notFound('Episode not found');
    }
    if (!episode.videoAsset) {
      throw DomainError.notFound('Episode playback asset not found');
    }

    const videoAsset = episode.videoAsset;

    if (episode.isFree) {
      return this.toPlaybackGranted({ ...episode, videoAsset }, 'free');
    }

    if (userId) {
      const [unlock, subscription] = await Promise.all([
        this.prisma.episodeUnlock.findFirst({
          where: { userId, episodeId: episode.id },
          select: { id: true },
        }),
        this.prisma.subscription.findFirst({
          where: {
            userId,
            status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] },
            currentPeriodEnd: { gt: now },
          },
          select: { id: true },
        }),
      ]);

      if (unlock) {
        return this.toPlaybackGranted({ ...episode, videoAsset }, 'unlocked');
      }
      if (subscription) {
        return this.toPlaybackGranted({ ...episode, videoAsset }, 'subscription');
      }
    }

    return {
      episodeId: episode.id,
      dramaId: episode.dramaId,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      durationSeconds: episode.durationSeconds,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: episode.drama.coinPerEpisode,
    };
  }

  async getBySlug(slug: string, userId: string | null): Promise<DramaDetail> {
    const now = new Date();
    const drama = await this.prisma.drama.findFirst({
      where: {
        slug,
        status: PUBLISHED,
        deletedAt: null,
        OR: publishedAtVisible(now),
      },
      include: {
        episodes: {
          where: { isPublished: true, deletedAt: null },
          orderBy: { episodeNumber: 'asc' },
        },
      },
    });
    if (!drama) {
      throw DomainError.notFound('Drama not found');
    }

    const episodeIds = drama.episodes.map((e) => e.id);
    const unlockedIds = new Set<string>();
    const progressByEpisode = new Map<string, EpisodeProgress>();

    if (userId && episodeIds.length > 0) {
      const [unlocks, progresses] = await Promise.all([
        this.prisma.episodeUnlock.findMany({
          where: { userId, episodeId: { in: episodeIds } },
          select: { episodeId: true },
        }),
        this.prisma.watchProgress.findMany({
          where: { userId, episodeId: { in: episodeIds } },
        }),
      ]);
      for (const unlock of unlocks) unlockedIds.add(unlock.episodeId);
      for (const p of progresses) {
        progressByEpisode.set(p.episodeId, {
          positionSeconds: p.positionSeconds,
          durationSeconds: p.durationSeconds,
          completedAt: toIso(p.completedAt),
          lastWatchedAt: p.lastWatchedAt.toISOString(),
        });
      }
    }

    const episodes: EpisodeSummary[] = drama.episodes.map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      synopsis: ep.synopsis,
      durationSeconds: ep.durationSeconds,
      isFree: ep.isFree,
      publishedAt: toIso(ep.publishedAt),
      isUnlocked: ep.isFree || unlockedIds.has(ep.id),
      progress: progressByEpisode.get(ep.id) ?? null,
    }));

    return {
      ...toDramaSummary(drama),
      episodes,
    };
  }

  async saveProgress(userId: string, input: SaveWatchProgressInput): Promise<WatchProgress> {
    const now = new Date();
    const episode = await this.prisma.episode.findFirst({
      where: {
        id: input.episodeId,
        isPublished: true,
        deletedAt: null,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        drama: {
          status: PUBLISHED,
          deletedAt: null,
          OR: publishedAtVisible(now),
        },
      },
      select: { id: true, dramaId: true, durationSeconds: true, isFree: true },
    });
    if (!episode) {
      throw DomainError.notFound('Episode not found');
    }

    if (!episode.isFree) {
      const [unlock, subscription] = await Promise.all([
        this.prisma.episodeUnlock.findFirst({
          where: { userId, episodeId: episode.id },
          select: { id: true },
        }),
        this.prisma.subscription.findFirst({
          where: {
            userId,
            status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] },
            currentPeriodEnd: { gt: now },
          },
          select: { id: true },
        }),
      ]);
      if (!unlock && !subscription) {
        throw DomainError.forbidden('Episode is locked');
      }
    }

    const durationSeconds =
      episode.durationSeconds === null
        ? (input.durationSeconds ?? null)
        : Math.min(input.durationSeconds ?? episode.durationSeconds, episode.durationSeconds);
    const positionSeconds =
      durationSeconds === null
        ? input.positionSeconds
        : Math.min(input.positionSeconds, durationSeconds);
    const data = {
      positionSeconds,
      durationSeconds,
      completedAt: input.completed ? now : null,
      lastWatchedAt: now,
    };
    const existing = await this.prisma.watchProgress.findFirst({
      where: { userId, episodeId: episode.id },
      select: { id: true },
    });
    const progress = existing
      ? await this.prisma.watchProgress.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.watchProgress.create({
          data: {
            userId,
            guestId: null,
            dramaId: episode.dramaId,
            episodeId: episode.id,
            ...data,
          },
        });
    return toWatchProgress(progress);
  }

  async listContinueWatching(userId: string, limit = 10): Promise<ContinueWatching> {
    const items = await this.prisma.watchProgress.findMany({
      where: { userId },
      orderBy: { lastWatchedAt: 'desc' },
      take: limit,
      include: {
        drama: { select: { id: true, slug: true, title: true, posterUrl: true } },
        episode: { select: { id: true, episodeNumber: true, title: true } },
      },
    });
    return {
      items: items.map((item) => ({
        drama: item.drama,
        episode: item.episode,
        progress: toWatchProgress(item),
      })),
    };
  }
}
