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
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  watchProgress: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  episode: {
    findFirst: jest.fn(),
  },
  subscription: {
    findFirst: jest.fn(),
  },
  user: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  coinTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
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
    prisma.subscription.findFirst.mockResolvedValue(null);
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
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: { in: ['active', 'past_due', 'canceled'] },
        currentPeriodEnd: { gt: now },
      },
      select: { id: true },
    });
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

  it('returns playback HLS URL for a free published episode', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-1',
      dramaId: 'drama-1',
      episodeNumber: 1,
      title: 'The Trap',
      durationSeconds: 60,
      isFree: true,
      videoAsset: {
        playbackUrl: 'https://cdn.example/drama/episode-1.m3u8',
        provider: 'external_hls',
        thumbnailUrl: 'https://cdn.example/thumb.jpg',
      },
    });
    const service = new DramasService({ prisma: prisma as never });

    await expect(service.getPlayback('episode-1', null)).resolves.toEqual({
      episodeId: 'episode-1',
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
    expect(prisma.episodeUnlock.findFirst).not.toHaveBeenCalled();
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('omits HLS URL and returns paywall data for locked paid episode', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      isFree: false,
      drama: { coinPerEpisode: 5 },
      videoAsset: {
        playbackUrl: 'https://cdn.example/drama/episode-2.m3u8',
        provider: 'external_hls',
        thumbnailUrl: null,
      },
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue(null);
    const service = new DramasService({ prisma: prisma as never });

    await expect(service.getPlayback('episode-2', 'user-1')).resolves.toEqual({
      episodeId: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      access: 'denied',
      accessReason: 'locked',
      coinPerEpisode: 5,
    });
  });

  it('returns playback HLS URL for an individually unlocked paid episode', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      isFree: false,
      drama: { coinPerEpisode: 5 },
      videoAsset: {
        playbackUrl: 'https://cdn.example/drama/episode-2.m3u8',
        provider: 'external_hls',
        thumbnailUrl: null,
      },
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue({ id: 'unlock-1' });
    prisma.subscription.findFirst.mockResolvedValue(null);
    const service = new DramasService({ prisma: prisma as never });

    const playback = await service.getPlayback('episode-2', 'user-1');

    expect(playback).toMatchObject({
      access: 'granted',
      accessReason: 'unlocked',
      hlsUrl: 'https://cdn.example/drama/episode-2.m3u8',
    });
    expect(prisma.episodeUnlock.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', episodeId: 'episode-2' },
      select: { id: true },
    });
  });

  it('returns playback HLS URL for a subscription-accessible paid episode', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      isFree: false,
      drama: { coinPerEpisode: 5 },
      videoAsset: {
        playbackUrl: 'https://cdn.example/drama/episode-2.m3u8',
        provider: 'external_hls',
        thumbnailUrl: null,
      },
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    const service = new DramasService({ prisma: prisma as never });

    const playback = await service.getPlayback('episode-2', 'user-1');

    expect(playback).toMatchObject({
      access: 'granted',
      accessReason: 'subscription',
      hlsUrl: 'https://cdn.example/drama/episode-2.m3u8',
    });
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: { in: ['active', 'past_due', 'canceled'] },
        currentPeriodEnd: { gt: now },
      },
      select: { id: true },
    });
  });

  it('idempotently returns an existing episode unlock without spending coins', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      isFree: false,
      drama: { coinPerEpisode: 5 },
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue({
      id: 'unlock-1',
      method: 'COINS',
      unlockedAt: now,
    });
    const service = new DramasService({ prisma: prisma as never });

    await expect(service.unlockEpisode('episode-2', 'user-1')).resolves.toEqual({
      episodeId: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      access: 'granted',
      accessReason: 'unlocked',
      unlockId: 'unlock-1',
      method: 'COINS',
      coinCost: 0,
      balanceAfter: null,
      transactionId: null,
      unlockedAt: now.toISOString(),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('grants subscription episode unlock without spending coins', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      isFree: false,
      drama: { coinPerEpisode: 5 },
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    prisma.episodeUnlock.create.mockResolvedValue({
      id: 'unlock-sub',
      method: 'SUBSCRIPTION',
      unlockedAt: now,
    });
    const service = new DramasService({ prisma: prisma as never });

    await expect(service.unlockEpisode('episode-2', 'user-1')).resolves.toMatchObject({
      accessReason: 'subscription',
      unlockId: 'unlock-sub',
      method: 'SUBSCRIPTION',
      coinCost: 0,
      balanceAfter: null,
      transactionId: null,
    });
    expect(prisma.episodeUnlock.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', episodeId: 'episode-2', method: 'SUBSCRIPTION' },
      select: { id: true, method: true, unlockedAt: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('maps insufficient coin balance to a 402 paywall error without creating an unlock', async () => {
    const prisma = prismaStub();
    const tx = prismaStub();
    prisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      isFree: false,
      drama: { coinPerEpisode: 5 },
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue(null);
    tx.episodeUnlock.findFirst.mockResolvedValue(null);
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    tx.user.findUnique.mockResolvedValue({ coinBalance: 3, deletedAt: null });
    const service = new DramasService({ prisma: prisma as never });

    await expect(service.unlockEpisode('episode-2', 'user-1')).rejects.toMatchObject({
      status: 402,
      message: 'Insufficient coin balance',
      context: { episodeId: 'episode-2', coinCost: 5, currentBalance: 3 },
    });
    expect(tx.coinTransaction.create).not.toHaveBeenCalled();
    expect(tx.episodeUnlock.create).not.toHaveBeenCalled();
  });

  it('atomically spends coins and creates an episode unlock ledger', async () => {
    const prisma = prismaStub();
    const tx = prismaStub();
    prisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      episodeNumber: 2,
      title: 'The Escape',
      durationSeconds: 70,
      isFree: false,
      drama: { coinPerEpisode: 5 },
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue(null);
    tx.episodeUnlock.findFirst.mockResolvedValue(null);
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUnique.mockResolvedValue({ coinBalance: 15, deletedAt: null });
    tx.coinTransaction.create.mockResolvedValue({ id: 'txn-1' });
    tx.episodeUnlock.create.mockResolvedValue({
      id: 'unlock-coin',
      method: 'COINS',
      unlockedAt: now,
    });
    const service = new DramasService({ prisma: prisma as never });

    await expect(service.unlockEpisode('episode-2', 'user-1')).resolves.toMatchObject({
      accessReason: 'unlocked',
      unlockId: 'unlock-coin',
      method: 'COINS',
      coinCost: 5,
      balanceAfter: 15,
      transactionId: 'txn-1',
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', deletedAt: null, coinBalance: { gte: 5 } },
      data: { coinBalance: { increment: -5 } },
    });
    expect(tx.coinTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        amount: -5,
        type: 'EPISODE_UNLOCK',
        relatedId: 'episode-2',
        balanceAfter: 15,
      },
      select: { id: true },
    });
    expect(tx.episodeUnlock.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', episodeId: 'episode-2', method: 'COINS' },
      select: { id: true, method: true, unlockedAt: true },
    });
  });

  it('marks paid episodes unlocked when the user has an active subscription', async () => {
    const prisma = prismaStub();
    prisma.drama.findFirst.mockResolvedValue({
      ...baseDrama,
      episodes: [
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
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    prisma.episodeUnlock.findMany.mockResolvedValue([]);
    prisma.watchProgress.findMany.mockResolvedValue([]);
    const service = new DramasService({ prisma: prisma as never });

    const detail = await service.getBySlug('shadow-heiress', 'user-1');

    expect(detail.episodes).toEqual([
      expect.objectContaining({
        id: 'episode-2',
        isFree: false,
        isUnlocked: true,
      }),
    ]);
  });

  it('upserts authenticated watch progress after access validation', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      durationSeconds: 70,
      isFree: false,
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue({ id: 'unlock-1' });
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.watchProgress.findFirst.mockResolvedValue({ id: 'progress-1' });
    prisma.watchProgress.update.mockResolvedValue({
      episodeId: 'episode-2',
      dramaId: 'drama-1',
      positionSeconds: 70,
      durationSeconds: 70,
      completedAt: now,
      lastWatchedAt: now,
    });
    const service = new DramasService({ prisma: prisma as never });

    await expect(
      service.saveProgress('user-1', {
        episodeId: 'episode-2',
        positionSeconds: 72,
        durationSeconds: 90,
        completed: true,
      }),
    ).resolves.toEqual({
      episodeId: 'episode-2',
      dramaId: 'drama-1',
      positionSeconds: 70,
      durationSeconds: 70,
      completedAt: now.toISOString(),
      lastWatchedAt: now.toISOString(),
    });
    expect(prisma.episodeUnlock.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', episodeId: 'episode-2' },
      select: { id: true },
    });
    expect(prisma.watchProgress.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', episodeId: 'episode-2' },
      select: { id: true, positionSeconds: true, completedAt: true },
    });
    expect(prisma.watchProgress.update).toHaveBeenCalledWith({
      where: { id: 'progress-1' },
      data: {
        positionSeconds: 70,
        durationSeconds: 70,
        completedAt: now,
        lastWatchedAt: now,
      },
    });
  });

  it('rejects progress saves for locked paid episodes', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-2',
      dramaId: 'drama-1',
      durationSeconds: 70,
      isFree: false,
    });
    prisma.episodeUnlock.findFirst.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue(null);
    const service = new DramasService({ prisma: prisma as never });

    await expect(
      service.saveProgress('user-1', {
        episodeId: 'episode-2',
        positionSeconds: 42,
        durationSeconds: 70,
      }),
    ).rejects.toMatchObject({ status: 403, message: 'Episode is locked' });
    expect(prisma.watchProgress.findFirst).not.toHaveBeenCalled();
    expect(prisma.watchProgress.create).not.toHaveBeenCalled();
    expect(prisma.watchProgress.update).not.toHaveBeenCalled();
  });

  it('rejects invalid negative progress values before reading episode state', async () => {
    const prisma = prismaStub();
    const service = new DramasService({ prisma: prisma as never });

    await expect(
      service.saveProgress('user-1', {
        episodeId: 'episode-1',
        positionSeconds: -1,
        durationSeconds: 70,
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Progress values must be non-negative' });
    expect(prisma.episode.findFirst).not.toHaveBeenCalled();
  });

  it('keeps saved position and completion monotonic while accepting the latest watch timestamp', async () => {
    const prisma = prismaStub();
    const completedAt = new Date('2026-05-10T11:00:00.000Z');
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-1',
      dramaId: 'drama-1',
      durationSeconds: 70,
      isFree: true,
    });
    prisma.watchProgress.findFirst.mockResolvedValue({
      id: 'progress-1',
      positionSeconds: 55,
      completedAt,
    });
    prisma.watchProgress.update.mockResolvedValue({
      episodeId: 'episode-1',
      dramaId: 'drama-1',
      positionSeconds: 55,
      durationSeconds: 70,
      completedAt,
      lastWatchedAt: now,
    });
    const service = new DramasService({ prisma: prisma as never });

    await expect(
      service.saveProgress('user-1', {
        episodeId: 'episode-1',
        positionSeconds: 20,
        durationSeconds: 70,
      }),
    ).resolves.toMatchObject({
      positionSeconds: 55,
      completedAt: completedAt.toISOString(),
      lastWatchedAt: now.toISOString(),
    });
    expect(prisma.episodeUnlock.findFirst).not.toHaveBeenCalled();
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    expect(prisma.watchProgress.update).toHaveBeenCalledWith({
      where: { id: 'progress-1' },
      data: {
        positionSeconds: 55,
        durationSeconds: 70,
        completedAt,
        lastWatchedAt: now,
      },
    });
  });

  it('recovers from concurrent progress create races by updating the existing row', async () => {
    const prisma = prismaStub();
    prisma.episode.findFirst.mockResolvedValue({
      id: 'episode-1',
      dramaId: 'drama-1',
      durationSeconds: 70,
      isFree: true,
    });
    prisma.watchProgress.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'progress-1', positionSeconds: 40, completedAt: null });
    prisma.watchProgress.create.mockRejectedValue({ code: 'P2002' });
    prisma.watchProgress.update.mockResolvedValue({
      episodeId: 'episode-1',
      dramaId: 'drama-1',
      positionSeconds: 42,
      durationSeconds: 70,
      completedAt: null,
      lastWatchedAt: now,
    });
    const service = new DramasService({ prisma: prisma as never });

    await expect(
      service.saveProgress('user-1', {
        episodeId: 'episode-1',
        positionSeconds: 42,
        durationSeconds: 70,
      }),
    ).resolves.toMatchObject({ positionSeconds: 42, lastWatchedAt: now.toISOString() });
    expect(prisma.watchProgress.update).toHaveBeenCalledWith({
      where: { id: 'progress-1' },
      data: {
        positionSeconds: 42,
        durationSeconds: 70,
        completedAt: null,
        lastWatchedAt: now,
      },
    });
  });

  it('lists continue watching entries ordered by last watched time', async () => {
    const prisma = prismaStub();
    prisma.watchProgress.findMany.mockResolvedValue([
      {
        episodeId: 'episode-2',
        dramaId: 'drama-1',
        positionSeconds: 42,
        durationSeconds: 70,
        completedAt: null,
        lastWatchedAt: now,
        drama: {
          id: 'drama-1',
          slug: 'shadow-heiress',
          title: 'Shadow Heiress',
          posterUrl: 'https://cdn.example/poster.jpg',
        },
        episode: { id: 'episode-2', episodeNumber: 2, title: 'The Escape' },
      },
    ]);
    const service = new DramasService({ prisma: prisma as never });

    await expect(service.listContinueWatching('user-1')).resolves.toEqual({
      items: [
        {
          drama: {
            id: 'drama-1',
            slug: 'shadow-heiress',
            title: 'Shadow Heiress',
            posterUrl: 'https://cdn.example/poster.jpg',
          },
          episode: { id: 'episode-2', episodeNumber: 2, title: 'The Escape' },
          progress: {
            episodeId: 'episode-2',
            dramaId: 'drama-1',
            positionSeconds: 42,
            durationSeconds: 70,
            completedAt: null,
            lastWatchedAt: now.toISOString(),
          },
        },
      ],
    });
    expect(prisma.watchProgress.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { lastWatchedAt: 'desc' },
      take: 10,
      include: {
        drama: { select: { id: true, slug: true, title: true, posterUrl: true } },
        episode: { select: { id: true, episodeNumber: true, title: true } },
      },
    });
  });
});
