import type { Prisma, PrismaClient } from '@prisma/client';

import { DomainError } from '../../common/domain.errors';

import type {
  DramaDetail,
  DramaSummary,
  EpisodeProgress,
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
