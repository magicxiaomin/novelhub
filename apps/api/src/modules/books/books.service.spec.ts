import type { CacheClient } from '../cache/cache.constants';

import { BooksService, type BooksServiceDeps } from './books.service';

type FakeBook = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  category: string;
  tags: string[];
  status: string;
  isFeatured: boolean;
  totalChapters: number;
  freeChapterCount: number;
  coinPerChapter: number;
  createdAt: Date;
  deletedAt: Date | null;
};

type FakeChapter = {
  id: string;
  bookId: string;
  order: number;
  title: string;
  isFree: boolean;
  wordCount: number;
  deletedAt: Date | null;
};

const fakeBook = (overrides: Partial<FakeBook> = {}): FakeBook => ({
  id: overrides.id ?? 'book-1',
  title: 'Alpha’s Forbidden Mate',
  author: 'Sarah K.',
  coverUrl: 'https://covers/1',
  description: 'desc',
  category: 'Werewolf',
  tags: [],
  status: 'ONGOING',
  isFeatured: false,
  totalChapters: 5,
  freeChapterCount: 3,
  coinPerChapter: 5,
  createdAt: new Date('2026-01-01'),
  deletedAt: null,
  ...overrides,
});

const buildPrismaStub = (state: { books: FakeBook[]; chapters: FakeChapter[] }) => ({
  book: {
    findMany: jest.fn(
      async ({
        where,
        skip = 0,
        take = 100,
      }: {
        where: Record<string, unknown>;
        orderBy?: unknown;
        skip?: number;
        take?: number;
      }) => {
        let rows = state.books.filter((b) => !b.deletedAt);
        if (where.category) rows = rows.filter((b) => b.category === where.category);
        if (where.status) rows = rows.filter((b) => b.status === where.status);
        if (typeof where.isFeatured === 'boolean')
          rows = rows.filter((b) => b.isFeatured === where.isFeatured);
        if (where.OR) {
          const terms = where.OR as Array<Record<string, { contains: string; mode: string }>>;
          const term = terms[0]!.title!.contains.toLowerCase();
          rows = rows.filter(
            (b) => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term),
          );
        }
        return rows.slice(skip, skip + take);
      },
    ),
    findFirst: jest.fn(
      async ({ where, include }: { where: { id: string }; include?: { chapters?: unknown } }) => {
        const b = state.books.find((bb) => bb.id === where.id && !bb.deletedAt);
        if (!b) return null;
        if (include?.chapters) {
          const chapters = state.chapters
            .filter((c) => c.bookId === b.id && !c.deletedAt)
            .sort((a, c) => a.order - c.order)
            .slice(0, 10);
          return { ...b, chapters };
        }
        return b;
      },
    ),
    count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      let rows = state.books.filter((b) => !b.deletedAt);
      if (where.category) rows = rows.filter((b) => b.category === where.category);
      if (where.status) rows = rows.filter((b) => b.status === where.status);
      if (typeof where.isFeatured === 'boolean')
        rows = rows.filter((b) => b.isFeatured === where.isFeatured);
      if (where.OR) {
        const terms = where.OR as Array<Record<string, { contains: string; mode: string }>>;
        const term = terms[0]!.title!.contains.toLowerCase();
        rows = rows.filter(
          (b) => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term),
        );
      }
      return rows.length;
    }),
    groupBy: jest.fn(async () => {
      const counts = new Map<string, number>();
      for (const b of state.books.filter((bb) => !bb.deletedAt)) {
        counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([category, n]) => ({
        category,
        _count: { _all: n },
      }));
    }),
  },
  chapter: {
    findMany: jest.fn(
      async ({
        where,
        skip = 0,
        take = 100,
      }: {
        where: { bookId: string; deletedAt: null };
        skip?: number;
        take?: number;
      }) => {
        const rows = state.chapters
          .filter((c) => c.bookId === where.bookId && !c.deletedAt)
          .sort((a, b) => a.order - b.order);
        return rows.slice(skip, skip + take);
      },
    ),
    count: jest.fn(async ({ where }: { where: { bookId: string; deletedAt: null } }) => {
      return state.chapters.filter((c) => c.bookId === where.bookId && !c.deletedAt).length;
    }),
  },
});

describe('BooksService', () => {
  const buildService = (
    state: ReturnType<typeof buildState>,
  ): {
    service: BooksService;
    cache: CacheClient & { get: jest.Mock; set: jest.Mock; del: jest.Mock };
    prisma: ReturnType<typeof buildPrismaStub>;
  } => {
    const cache = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      del: jest.fn(async () => undefined),
    };
    const prisma = buildPrismaStub(state);
    const deps = {
      prisma,
      cache,
    } as unknown as BooksServiceDeps;
    return { service: new BooksService(deps), cache: cache as never, prisma };
  };

  const buildState = () => ({
    books: [
      fakeBook({
        id: 'b1',
        title: 'Alpha One',
        category: 'Werewolf',
        isFeatured: true,
        status: 'ONGOING',
      }),
      fakeBook({ id: 'b2', title: 'CEO Two', category: 'Billionaire', status: 'COMPLETED' }),
      fakeBook({ id: 'b3', title: 'Wolf Three', category: 'Werewolf', isFeatured: false }),
    ],
    chapters: [
      {
        id: 'c1',
        bookId: 'b1',
        order: 1,
        title: 'Encounter',
        isFree: true,
        wordCount: 1200,
        deletedAt: null,
      },
      {
        id: 'c2',
        bookId: 'b1',
        order: 2,
        title: 'Stranger',
        isFree: true,
        wordCount: 1300,
        deletedAt: null,
      },
      {
        id: 'c3',
        bookId: 'b1',
        order: 3,
        title: 'Moonlight',
        isFree: false,
        wordCount: 1500,
        deletedAt: null,
      },
    ],
  });

  it('list filters by category', async () => {
    const { service } = await buildService(buildState());
    const out = await service.list({ category: 'Werewolf' });
    expect(out.total).toBe(2);
    expect(out.items.every((b) => b.category === 'Werewolf')).toBe(true);
  });

  it('list filters by status', async () => {
    const { service } = await buildService(buildState());
    const out = await service.list({ status: 'COMPLETED' });
    expect(out.total).toBe(1);
    expect(out.items[0]?.id).toBe('b2');
  });

  it('list filters by featured=true', async () => {
    const { service } = await buildService(buildState());
    const out = await service.list({ featured: true });
    expect(out.total).toBe(1);
    expect(out.items[0]?.id).toBe('b1');
  });

  it('list adds id as a deterministic secondary sort key for tied createdAt rows', async () => {
    const { service, prisma } = await buildService(buildState());
    await service.list({ page: 2, limit: 1 });
    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 1,
        take: 1,
      }),
    );
  });

  it('list returns cached value on cache hit', async () => {
    const { service, cache } = await buildService(buildState());
    cache.get.mockResolvedValueOnce({
      items: [{ id: 'cached' }],
      total: 99,
      page: 1,
      limit: 20,
    });
    const out = await service.list({});
    expect(out.total).toBe(99);
  });

  it('search returns empty when q is missing', async () => {
    const { service } = await buildService(buildState());
    const out = await service.search({});
    expect(out.total).toBe(0);
    expect(out.items).toEqual([]);
  });

  it('search matches title or author insensitively', async () => {
    const { service } = await buildService(buildState());
    const out = await service.search({ q: 'wolf' });
    expect(out.total).toBe(1);
    expect(out.items[0]?.id).toBe('b3');
  });

  it('search adds id as a deterministic secondary sort key for tied createdAt rows', async () => {
    const { service, prisma } = await buildService(buildState());
    await service.search({ q: 'sarah', page: 2, limit: 1 });
    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 1,
        take: 1,
      }),
    );
  });

  it('featured and trending lists add id as a deterministic secondary sort key', async () => {
    const { service, prisma } = await buildService(buildState());
    await service.featured();
    await service.trending();
    expect(prisma.book.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
    );
    expect(prisma.book.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
    );
  });

  it('search matches author', async () => {
    const { service } = await buildService(buildState());
    const out = await service.search({ q: 'sarah' });
    expect(out.total).toBe(3);
  });

  it('getById returns book detail with first chapters', async () => {
    const { service } = await buildService(buildState());
    const out = await service.getById('b1');
    expect(out.id).toBe('b1');
    expect(out.chapters).toHaveLength(3);
    expect(out.description).toBe('desc');
  });

  it('getById 404 for missing book', async () => {
    const { service } = await buildService(buildState());
    await expect(service.getById('missing')).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 404 }),
    );
  });

  it('listChapters paginates', async () => {
    const { service } = await buildService(buildState());
    const out = await service.listChapters('b1', { page: 1, limit: 2 });
    expect(out.total).toBe(3);
    expect(out.items).toHaveLength(2);
    expect(out.page).toBe(1);
    expect(out.limit).toBe(2);
  });

  it('listChapters 404 for missing book', async () => {
    const { service } = await buildService(buildState());
    await expect(service.listChapters('missing', {})).rejects.toEqual(
      expect.objectContaining({ name: 'DomainError', status: 404 }),
    );
  });

  it('categories returns counts sorted desc', async () => {
    const { service } = await buildService(buildState());
    const out = await service.categories();
    expect(out[0]).toEqual({ category: 'Werewolf', count: 2 });
    expect(out[1]).toEqual({ category: 'Billionaire', count: 1 });
  });
});
