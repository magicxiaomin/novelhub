import { DramasService } from './dramas.service';

const now = new Date('2026-05-10T12:00:00.000Z');

const baseDrama = {
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
  publishedAt: now,
};

const prismaStub = () => ({
  drama: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  episodeUnlock: {
    findMany: jest.fn(),
  },
  watchProgress: {
    findMany: jest.fn(),
  },
});

describe('DramasService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists only published visible dramas with pagination metadata', async () => {
    const prisma = prismaStub();
    prisma.drama.findMany.mockResolvedValue([baseDrama]);
    prisma.drama.count.mockResolvedValue(1);
    const service = new DramasService({ prisma: prisma as never });

    const result = await service.list({
      page: 2,
      pageSize: 10,
      category: 'revenge',
      featured: true,
    });

    expect(prisma.drama.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        category: 'revenge',
        isFeatured: true,
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { publishedAt: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({
      items: [{ ...baseDrama, publishedAt: now.toISOString() }],
      pageInfo: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it('returns ordered episode metadata with authenticated unlock and progress state', async () => {
    const prisma = prismaStub();
    prisma.drama.findFirst.mockResolvedValue({
      ...baseDrama,
      episodes: [
        {
          id: 'episode-1',
          episodeNumber: 1,
          title: 'The Trap',
          synopsis: 'Pilot',
          durationSeconds: 60,
          isFree: true,
          publishedAt: now,
        },
        {
          id: 'episode-2',
          episodeNumber: 2,
          title: 'The Escape',
          synopsis: null,
          durationSeconds: 70,
          isFree: false,
          publishedAt: now,
        },
      ],
    });
    prisma.episodeUnlock.findMany.mockResolvedValue([{ episodeId: 'episode-2' }]);
    prisma.watchProgress.findMany.mockResolvedValue([
      {
        episodeId: 'episode-2',
        positionSeconds: 33,
        durationSeconds: 70,
        completedAt: null,
        lastWatchedAt: now,
      },
    ]);
    const service = new DramasService({ prisma: prisma as never });

    const detail = await service.getBySlug('shadow-heiress', 'user-1');

    expect(prisma.drama.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'shadow-heiress',
          status: 'PUBLISHED',
          deletedAt: null,
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
        include: {
          episodes: {
            where: { isPublished: true, deletedAt: null },
            orderBy: { episodeNumber: 'asc' },
          },
        },
      }),
    );
    expect(detail.episodes).toEqual([
      {
        id: 'episode-1',
        episodeNumber: 1,
        title: 'The Trap',
        synopsis: 'Pilot',
        durationSeconds: 60,
        isFree: true,
        publishedAt: now.toISOString(),
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
        publishedAt: now.toISOString(),
        isUnlocked: true,
        progress: {
          positionSeconds: 33,
          durationSeconds: 70,
          completedAt: null,
          lastWatchedAt: now.toISOString(),
        },
      },
    ]);
  });
});
