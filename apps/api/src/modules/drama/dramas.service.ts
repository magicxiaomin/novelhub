import type { Prisma, PrismaClient } from '@prisma/client';

import { DomainError } from '../../common/domain.errors';
import { SUBSCRIPTION_ACTIVE_STATUSES } from '../auth/auth.constants';
import { CoinsService } from '../coins/coins.service';
import { InsufficientBalanceError } from '../coins/insufficient-balance.exception';
import type {
  DramaDetail,
  DramaSummary,
  EpisodePlayback,
  EpisodePlaybackGranted,
  EpisodeProgress,
  EpisodeUnlockResult,
  EpisodeSummary,
  ListDramasQuery,
  Paginated,
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

// `publishedAt <= now OR null` — the schema permits a published drama with a
// null `publishedAt` (admin marked it PUBLISHED without scheduling), so we
// surface those in the list rather than hiding them behind a date check that
// would misread null as "unscheduled future."
const publishedAtVisible = (now: Date): Prisma.DramaWhereInput[] => [
  { publishedAt: null },
  { publishedAt: { lte: now } },
];

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

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

  private async findUnlockableEpisode(episodeId: string): Promise<{
    id: string;
    dramaId: string;
    episodeNumber: number;
    isFree: boolean;
    drama: { coinPerEpisode: number };
  }> {
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
        isFree: true,
        drama: { select: { coinPerEpisode: true } },
      },
    });
    if (!episode) throw DomainError.notFound('Episode not found');
    return episode;
  }

  private toUnlockResult(
    episode: { id: string; dramaId: string; episodeNumber: number },
    unlock: { id: string; method: string; unlockedAt: Date },
    accessReason: EpisodeUnlockResult['accessReason'],
    coinCost: number,
    balanceAfter: number | null,
    transactionId: string | null,
  ): EpisodeUnlockResult {
    return {
      episodeId: episode.id,
      dramaId: episode.dramaId,
      episodeNumber: episode.episodeNumber,
      access: 'granted',
      accessReason,
      unlockId: unlock.id,
      method: unlock.method,
      coinCost,
      balanceAfter,
      transactionId,
      unlockedAt: unlock.unlockedAt.toISOString(),
    };
  }

  async unlockEpisode(episodeId: string, userId: string): Promise<EpisodeUnlockResult> {
    const now = new Date();
    const episode = await this.findUnlockableEpisode(episodeId);
    const coinCost = episode.drama.coinPerEpisode;

    try {
      const existing = await this.prisma.episodeUnlock.findFirst({
        where: { userId, episodeId: episode.id },
        select: { id: true, method: true, unlockedAt: true },
      });
      if (existing) {
        return this.toUnlockResult(episode, existing, 'unlocked', 0, null, null);
      }

      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] },
          currentPeriodEnd: { gt: now },
        },
        select: { id: true },
      });
      if (subscription || episode.isFree) {
        const unlock = await this.prisma.episodeUnlock.create({
          data: { userId, episodeId: episode.id, method: subscription ? 'SUBSCRIPTION' : 'FREE' },
          select: { id: true, method: true, unlockedAt: true },
        });
        return this.toUnlockResult(
          episode,
          unlock,
          subscription ? 'subscription' : 'unlocked',
          0,
          null,
          null,
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        const unlockInTx = await tx.episodeUnlock.findFirst({
          where: { userId, episodeId: episode.id },
          select: { id: true, method: true, unlockedAt: true },
        });
        if (unlockInTx) {
          return this.toUnlockResult(episode, unlockInTx, 'unlocked', 0, null, null);
        }

        const coins = new CoinsService({ prisma: this.prisma });
        const adjustment = await coins.adjustBalance(
          userId,
          -coinCost,
          'EPISODE_UNLOCK',
          episode.id,
          tx,
        );
        const unlock = await tx.episodeUnlock.create({
          data: { userId, episodeId: episode.id, method: 'COINS' },
          select: { id: true, method: true, unlockedAt: true },
        });
        return this.toUnlockResult(
          episode,
          unlock,
          'unlocked',
          coinCost,
          adjustment.balance,
          adjustment.transactionId,
        );
      });
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        throw DomainError.paymentRequired('Insufficient coin balance', {
          episodeId: episode.id,
          coinCost,
          currentBalance: error.current,
        });
      }
      if (isUniqueConstraintError(error)) {
        const unlock = await this.prisma.episodeUnlock.findFirst({
          where: { userId, episodeId: episode.id },
          select: { id: true, method: true, unlockedAt: true },
        });
        if (unlock) return this.toUnlockResult(episode, unlock, 'unlocked', 0, null, null);
      }
      throw error;
    }
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
}
