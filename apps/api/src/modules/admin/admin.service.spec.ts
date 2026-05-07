import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { BooksService } from '../books/books.service';
import type { CacheClient } from '../cache/cache.constants';
import type { StorageClient } from '../storage/storage.constants';

import { AdminService } from './admin.service';

const date = (iso: string): Date => new Date(iso);

type PrismaMock = {
  $transaction: jest.Mock;
  book: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  chapter: {
    aggregate: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
  chapterUnlock: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  user: {
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  order: {
    aggregate: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

type TxMock = {
  chapter: {
    aggregate: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  book: { update: jest.Mock };
};

const buildService = () => {
  const tx: TxMock = {
    chapter: {
      aggregate: jest.fn(async () => ({ _max: { order: 2 } })),
      create: jest.fn(async () => ({ id: `chapter-${tx.chapter.create.mock.calls.length}` })),
      update: jest.fn(async () => ({ id: 'chapter-1' })),
    },
    book: { update: jest.fn(async () => ({ id: 'book-1' })) },
  };
  const prisma: PrismaMock = {
    $transaction: jest.fn(async (callback: (client: TxMock) => Promise<unknown>) => callback(tx)),
    book: {
      create: jest.fn(async () => ({ id: 'book-1' })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async () => ({ id: 'book-1' })),
    },
    chapter: {
      aggregate: jest.fn(async () => ({ _max: { order: 0 } })),
      create: jest.fn(async () => ({ id: 'chapter-1' })),
      update: jest.fn(async () => ({ id: 'chapter-1' })),
      updateMany: jest.fn(async () => ({ count: 0 })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findFirst: jest.fn(async () => null),
    },
    chapterUnlock: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    user: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async () => ({ id: 'user-1' })),
    },
    order: {
      aggregate: jest.fn(async () => ({ _sum: { amount: 0 }, _count: { id: 0 } })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
  };
  const storage = {
    uploadText: jest.fn(async () => undefined),
    getText: jest.fn(async () => ''),
    getSignedUrl: jest.fn(async () => 'https://read.example/signed'),
    getSignedUploadUrl: jest.fn(async () => 'https://upload.example/signed'),
  } satisfies Partial<StorageClient>;
  const cache = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
  } satisfies Partial<CacheClient>;
  const books = {
    invalidateListCaches: jest.fn(async () => undefined),
  } satisfies Partial<BooksService>;
  const service = new AdminService(
    prisma as never,
    storage as StorageClient,
    cache as CacheClient,
    books as unknown as BooksService,
  );
  return { service, prisma, tx, storage, cache, books };
};

describe('AdminService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(date('2026-05-07T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('dashboardSummary returns today, weekly, and topBooks aggregates', async () => {
    const { service, prisma } = buildService();
    prisma.user.count.mockResolvedValue(3);
    prisma.order.findMany
      .mockResolvedValueOnce([{ userId: 'user-1' }, { userId: 'user-2' }])
      .mockResolvedValueOnce([
        { amount: 499, completedAt: date('2026-05-06T10:00:00.000Z') },
        { amount: 1299, completedAt: date('2026-05-07T10:00:00.000Z') },
      ]);
    prisma.order.aggregate.mockResolvedValue({ _sum: { amount: 1299 } });
    prisma.user.findMany.mockResolvedValue([
      { createdAt: date('2026-05-06T10:00:00.000Z') },
      { createdAt: date('2026-05-07T10:00:00.000Z') },
    ]);
    prisma.chapterUnlock.findMany.mockResolvedValue([
      {
        chapter: {
          book: { id: 'book-1', title: 'Alpha', coverUrl: 'https://covers/1', coinPerChapter: 5 },
        },
      },
      {
        chapter: {
          book: { id: 'book-1', title: 'Alpha', coverUrl: 'https://covers/1', coinPerChapter: 5 },
        },
      },
      {
        chapter: {
          book: { id: 'book-2', title: 'Beta', coverUrl: 'https://covers/2', coinPerChapter: 8 },
        },
      },
    ]);

    const result = await service.dashboardSummary();

    expect(result.today).toEqual({
      signups: 3,
      payingUsers: 2,
      revenueCents: 1299,
      estimatedRoasCents: 0,
    });
    expect(result.weekly).toHaveLength(7);
    expect(result.weekly.at(-1)).toMatchObject({
      date: '2026-05-07',
      signups: 1,
      revenueCents: 1299,
    });
    expect(result.topBooks).toEqual([
      { id: 'book-1', title: 'Alpha', coverUrl: 'https://covers/1', revenueCents: 100 },
      { id: 'book-2', title: 'Beta', coverUrl: 'https://covers/2', revenueCents: 80 },
    ]);
    expect(prisma.chapterUnlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ method: 'COINS' }),
      }),
    );
  });

  it('dashboardSummary returns an empty topBooks list when there are no coin unlocks', async () => {
    const { service } = buildService();
    await expect(service.dashboardSummary()).resolves.toMatchObject({ topBooks: [] });
  });

  it('listBooks applies pagination and title search', async () => {
    const { service, prisma } = buildService();
    prisma.book.findMany.mockResolvedValue([{ id: 'book-1', title: 'Alpha' }]);
    prisma.book.count.mockResolvedValue(1);

    const result = await service.listBooks({ page: 2, limit: 10, search: 'alp' });

    expect(result).toMatchObject({ total: 1, page: 2, limit: 10 });
    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, title: { contains: 'alp', mode: 'insensitive' } },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('getBook returns an editable book including coverUrl', async () => {
    const { service, prisma } = buildService();
    prisma.book.findFirst.mockResolvedValue({
      id: 'book-1',
      title: 'Alpha',
      author: 'A',
      coverUrl: 'https://covers/1',
      coverImageKey: null,
      description: 'Desc',
      category: 'Drama',
      tags: [],
      status: 'ONGOING',
      isFeatured: false,
      freeChapterCount: 3,
      coinPerChapter: 5,
    });

    await expect(service.getBook('book-1')).resolves.toMatchObject({
      id: 'book-1',
      coverUrl: 'https://covers/1',
    });
  });

  it('getBook throws when the book is missing', async () => {
    const { service } = buildService();
    await expect(service.getBook('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bulkCreateChapters uploads content before the DB transaction and creates sequential rows', async () => {
    const { service, prisma, tx, storage, cache } = buildService();
    const ordering: string[] = [];
    prisma.book.findFirst.mockResolvedValue({ id: 'book-1', freeChapterCount: 3 });
    storage.uploadText.mockImplementation(async () => {
      ordering.push('upload');
    });
    prisma.$transaction.mockImplementation(
      async (callback: (client: TxMock) => Promise<unknown>) => {
        ordering.push('transaction');
        return callback(tx);
      },
    );

    const result = await service.bulkCreateChapters('book-1', [
      { title: 'One', content: 'first' },
      { title: 'Two', content: 'second', isFree: false },
    ]);

    expect(result).toEqual({ created: 2 });
    expect(ordering).toEqual(['upload', 'upload', 'transaction']);
    expect(tx.chapter.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ order: 3, title: 'One', isFree: true }),
      }),
    );
    expect(tx.chapter.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ order: 4, title: 'Two', isFree: false }),
      }),
    );
    expect(cache.set).toHaveBeenCalledTimes(2);
  });

  it('bulkCreateChapters rejects content over 200 KB before uploading', async () => {
    const { service, storage } = buildService();
    await expect(
      service.bulkCreateChapters('book-1', [{ title: 'Large', content: 'x'.repeat(204801) }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.uploadText).not.toHaveBeenCalled();
  });

  it('bulkCreateChapters rejects when the book is missing', async () => {
    const { service, storage } = buildService();
    await expect(
      service.bulkCreateChapters('missing', [{ title: 'One', content: 'body' }]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.uploadText).not.toHaveBeenCalled();
  });

  it('listChapters applies bookId filter and returns pagination shape', async () => {
    const { service, prisma } = buildService();
    prisma.chapter.findMany.mockResolvedValue([
      {
        id: 'chapter-1',
        bookId: 'book-1',
        order: 1,
        title: 'One',
        isFree: true,
        wordCount: 10,
        updatedAt: date('2026-05-07T00:00:00.000Z'),
        book: { title: 'Alpha' },
      },
    ]);
    prisma.chapter.count.mockResolvedValue(1);

    const result = await service.listChapters({ bookId: 'book-1', page: 1, limit: 20 });

    expect(result.items[0]).toMatchObject({ id: 'chapter-1', bookTitle: 'Alpha' });
    expect(result).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, bookId: 'book-1' } }),
    );
  });

  it('getChapter returns content from storage', async () => {
    const { service, prisma, storage } = buildService();
    prisma.chapter.findFirst.mockResolvedValue({
      id: 'chapter-1',
      bookId: 'book-1',
      order: 1,
      title: 'One',
      isFree: true,
      contentUrl: 'chapters/book-1/chapter-1.txt',
    });
    storage.getText.mockResolvedValue('Chapter body');

    await expect(service.getChapter('chapter-1')).resolves.toMatchObject({
      content: 'Chapter body',
    });
  });

  it('getChapter throws when the chapter is missing', async () => {
    const { service } = buildService();
    await expect(service.getChapter('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listUsers searches by email prefix and returns pagination shape', async () => {
    const { service, prisma } = buildService();
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', email: 'a@example.com' }]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.listUsers({ page: 3, limit: 5, search: 'a' });

    expect(result).toMatchObject({ total: 1, page: 3, limit: 5 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, email: { startsWith: 'a', mode: 'insensitive' } },
        skip: 10,
        take: 5,
      }),
    );
  });

  it('getUser returns purchase and unlock aggregates', async () => {
    const { service, prisma } = buildService();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      coinBalance: 12,
      isAdmin: false,
      bannedAt: null,
      createdAt: date('2026-05-07T00:00:00.000Z'),
    });
    prisma.order.aggregate.mockResolvedValue({ _count: { id: 2 }, _sum: { amount: 1798 } });
    prisma.chapterUnlock.count.mockResolvedValue(4);

    await expect(service.getUser('user-1')).resolves.toMatchObject({
      purchases: { count: 2, sumCents: 1798 },
      unlocks: { count: 4 },
    });
  });

  it('getUser throws when the user is missing', async () => {
    const { service } = buildService();
    await expect(service.getUser('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('banUser sets bannedAt', async () => {
    const { service, prisma } = buildService();
    await expect(service.banUser('user-1')).resolves.toEqual({ id: 'user-1' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { bannedAt: expect.any(Date) },
    });
  });

  it('unbanUser clears bannedAt', async () => {
    const { service, prisma } = buildService();
    await expect(service.unbanUser('user-1')).resolves.toEqual({ id: 'user-1' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { bannedAt: null },
    });
  });

  it('listOrders searches by session or email and applies status filter', async () => {
    const { service, prisma } = buildService();
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        stripeSessionId: 'cs_1',
        type: 'COIN_PURCHASE',
        amount: 499,
        currency: 'usd',
        status: 'completed',
        createdAt: date('2026-05-07T00:00:00.000Z'),
        completedAt: date('2026-05-07T00:00:00.000Z'),
        user: { email: 'a@example.com' },
      },
    ]);
    prisma.order.count.mockResolvedValue(1);

    const result = await service.listOrders({ search: 'cs', status: 'completed' });

    expect(result.items[0]).toMatchObject({ userEmail: 'a@example.com' });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'completed',
          OR: [
            { stripeSessionId: { contains: 'cs', mode: 'insensitive' } },
            { user: { email: { contains: 'cs', mode: 'insensitive' } } },
          ],
        },
      }),
    );
  });

  it('coverUploadUrl returns an uploadUrl and key for allowed MIME types', async () => {
    const { service, storage } = buildService();
    await expect(service.coverUploadUrl('image/webp')).resolves.toMatchObject({
      uploadUrl: 'https://upload.example/signed',
    });
    expect(storage.getSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^covers\//),
      'image/webp',
    );
  });

  it('coverUploadUrl rejects SVG and other unsupported image types', async () => {
    const { service, storage } = buildService();
    await expect(service.coverUploadUrl('image/svg+xml')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.coverUploadUrl('image/gif')).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.getSignedUploadUrl).not.toHaveBeenCalled();
  });
});
