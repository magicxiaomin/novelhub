import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { GOOGLE_OAUTH_CLIENT, PRISMA } from '../src/modules/auth/auth.constants';
import { EmailService } from '../src/modules/auth/email.service';
import { CACHE_CLIENT } from '../src/modules/cache/cache.constants';
import { STORAGE_CLIENT } from '../src/modules/storage/storage.constants';

// v4 UUIDs (third group starts with `4`, fourth group's first hex is 8/9/a/b)
const ADMIN_USER_ID = '11111111-1111-4111-8111-111111111111';
const REGULAR_USER_ID = '22222222-2222-4222-9222-222222222222';
const BOOK_ID = '33333333-3333-4333-8333-333333333333';
const FREE_CHAPTER_ID = '44444444-4444-4444-8444-444444444444';
const PAID_CHAPTER_ID = '55555555-5555-4555-8555-555555555555';
const PAID_CHAPTER_2_ID = '66666666-6666-4666-8666-666666666666';

const buildState = async () => {
  const adminHash = await bcrypt.hash('admin-pass', 4);
  const userHash = await bcrypt.hash('user-pass', 4);

  return {
    users: new Map<
      string,
      {
        id: string;
        email: string;
        passwordHash: string;
        coinBalance: number;
        isAdmin: boolean;
        deletedAt: Date | null;
      }
    >([
      [
        ADMIN_USER_ID,
        {
          id: ADMIN_USER_ID,
          email: 'admin@example.com',
          passwordHash: adminHash,
          coinBalance: 0,
          isAdmin: true,
          deletedAt: null,
        },
      ],
      [
        REGULAR_USER_ID,
        {
          id: REGULAR_USER_ID,
          email: 'user@example.com',
          passwordHash: userHash,
          coinBalance: 100,
          isAdmin: false,
          deletedAt: null,
        },
      ],
    ]),
    books: [
      {
        id: BOOK_ID,
        title: 'Alpha’s Forbidden Mate',
        author: 'Sarah K.',
        coverUrl: 'https://covers/1',
        description: 'desc',
        category: 'Werewolf',
        tags: ['alpha', 'mate'],
        status: 'ONGOING',
        isFeatured: true,
        totalChapters: 3,
        freeChapterCount: 1,
        coinPerChapter: 5,
        createdAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ],
    chapters: [
      {
        id: FREE_CHAPTER_ID,
        bookId: BOOK_ID,
        order: 1,
        title: 'The Encounter',
        contentUrl: 'chapters/free.txt',
        wordCount: 1200,
        isFree: true,
        deletedAt: null,
      },
      {
        id: PAID_CHAPTER_ID,
        bookId: BOOK_ID,
        order: 2,
        title: 'Bound',
        contentUrl: 'chapters/paid.txt',
        wordCount: 1300,
        isFree: false,
        deletedAt: null,
      },
      {
        id: PAID_CHAPTER_2_ID,
        bookId: BOOK_ID,
        order: 3,
        title: 'Truth',
        contentUrl: 'chapters/paid2.txt',
        wordCount: 1400,
        isFree: false,
        deletedAt: null,
      },
    ],
  };
};

const buildPrismaStub = (state: Awaited<ReturnType<typeof buildState>>) => {
  const findChapter = (id: string) => state.chapters.find((c) => c.id === id) ?? null;
  const findBook = (id: string) => state.books.find((b) => b.id === id) ?? null;

  return {
    user: {
      findUnique: async ({ where }: { where: Record<string, string> }) => {
        if (where.id) return state.users.get(where.id) ?? null;
        if (where.email) {
          for (const u of state.users.values()) if (u.email === where.email) return u;
          return null;
        }
        return null;
      },
      create: async () => {
        throw new Error('user.create not used in this e2e');
      },
      update: async () => {
        throw new Error('user.update not used in this e2e');
      },
    },
    book: {
      findFirst: async ({
        where,
        include,
      }: {
        where: { id?: string; deletedAt: null };
        include?: { chapters?: { take?: number } };
      }) => {
        const id = where.id;
        if (!id) return null;
        const b = findBook(id);
        if (!b || b.deletedAt) return null;
        if (include?.chapters) {
          const chapters = state.chapters
            .filter((c) => c.bookId === b.id && !c.deletedAt)
            .sort((a, c) => a.order - c.order)
            .slice(0, include.chapters.take ?? 10);
          return { ...b, chapters };
        }
        return b;
      },
      findMany: async ({
        where,
        skip = 0,
        take = 100,
      }: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) => {
        let rows = state.books.filter((b) => !b.deletedAt);
        if (where.category) rows = rows.filter((b) => b.category === where.category);
        if (where.status) rows = rows.filter((b) => b.status === where.status);
        if (typeof where.isFeatured === 'boolean')
          rows = rows.filter((b) => b.isFeatured === where.isFeatured);
        return rows.slice(skip, skip + take);
      },
      count: async ({ where }: { where: Record<string, unknown> }) => {
        let rows = state.books.filter((b) => !b.deletedAt);
        if (where.category) rows = rows.filter((b) => b.category === where.category);
        return rows.length;
      },
      groupBy: async () => {
        const counts = new Map<string, number>();
        for (const b of state.books.filter((bb) => !bb.deletedAt)) {
          counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([category, n]) => ({
          category,
          _count: { _all: n },
        }));
      },
      create: async () => ({ id: 'new-book' }),
      update: async () => ({ id: BOOK_ID }),
    },
    chapter: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: Record<string, unknown>;
        orderBy?: { order?: 'asc' | 'desc' };
      }) => {
        const id = where.id as string | undefined;
        if (id) {
          const c = findChapter(id);
          if (!c || c.deletedAt) return null;
          return { ...c, book: findBook(c.bookId) };
        }
        const bookId = where.bookId as string | undefined;
        const orderFilter = where.order as { lt?: number; gt?: number } | undefined;
        if (bookId && orderFilter) {
          const candidates = state.chapters.filter(
            (c) =>
              c.bookId === bookId &&
              !c.deletedAt &&
              ((orderFilter.lt !== undefined && c.order < orderFilter.lt) ||
                (orderFilter.gt !== undefined && c.order > orderFilter.gt)),
          );
          candidates.sort((a, b) =>
            orderBy?.order === 'desc' ? b.order - a.order : a.order - b.order,
          );
          return candidates[0] ?? null;
        }
        return null;
      },
      findMany: async ({
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
      count: async ({ where }: { where: { bookId: string } }) =>
        state.chapters.filter((c) => c.bookId === where.bookId && !c.deletedAt).length,
    },
    chapterUnlock: {
      findUnique: async () => null,
    },
    subscription: {
      findFirst: async () => null,
    },
    coinTransaction: { create: async () => ({ id: 'txn' }) },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({}),
  };
};

describe('Books, Chapters, and Admin e2e', () => {
  let app: INestApplication;
  let state: Awaited<ReturnType<typeof buildState>>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';
    state = await buildState();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRISMA)
      .useValue(buildPrismaStub(state))
      .overrideProvider(EmailService)
      .useValue({
        sendWelcomeEmail: async () => undefined,
        sendPasswordResetEmail: async () => undefined,
      })
      .overrideProvider(GOOGLE_OAUTH_CLIENT)
      .useValue({ verifyIdToken: async () => ({ getPayload: () => ({}) }) })
      .overrideProvider(STORAGE_CLIENT)
      .useValue({
        uploadText: async () => undefined,
        getSignedUrl: async (key: string) => `https://signed/${key}`,
        getText: async () =>
          'The wind howled through the trees as Luna stepped into the clearing. Her heart raced with each step.',
      })
      .overrideProvider(CACHE_CLIENT)
      .useValue({
        get: async () => null,
        set: async () => undefined,
        del: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /books returns paginated summaries', async () => {
    const res = await request(app.getHttpServer()).get('/books').expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(BOOK_ID);
  });

  it('GET /books?category=Werewolf filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/books')
      .query({ category: 'Werewolf' })
      .expect(200);
    expect(res.body.total).toBe(1);
  });

  it('GET /books/categories returns counts', async () => {
    const res = await request(app.getHttpServer()).get('/books/categories').expect(200);
    expect(res.body[0]).toEqual({ category: 'Werewolf', count: 1 });
  });

  it('GET /books/:id returns detail with chapters', async () => {
    const res = await request(app.getHttpServer()).get(`/books/${BOOK_ID}`).expect(200);
    expect(res.body.id).toBe(BOOK_ID);
    expect(res.body.chapters).toHaveLength(3);
  });

  it('GET /books/:id/chapters paginates', async () => {
    const res = await request(app.getHttpServer())
      .get(`/books/${BOOK_ID}/chapters`)
      .query({ page: 1, limit: 2 })
      .expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(2);
  });

  it('GET /chapters/:id (free, guest) → unlocked content', async () => {
    const res = await request(app.getHttpServer()).get(`/chapters/${FREE_CHAPTER_ID}`).expect(200);
    expect(res.body.isLocked).toBe(false);
    expect(res.body.contentUrl).toContain('chapters/free.txt');
  });

  it('GET /chapters/:id (paid, guest) → locked envelope with preview', async () => {
    const res = await request(app.getHttpServer()).get(`/chapters/${PAID_CHAPTER_ID}`).expect(200);
    expect(res.body.isLocked).toBe(true);
    expect(res.body.preview).toMatch(/wind howled/);
    expect(res.body.unlockOptions.coinCost).toBe(5);
    expect(res.body.unlockOptions.canUnlockWithCoins).toBe(false);
  });

  it('POST /admin/books rejects non-admin user with 403', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'user-pass' })
      .expect(200);
    const cookies = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
    await request(app.getHttpServer())
      .post('/admin/books')
      .set('Cookie', cookieHeader)
      .send({
        title: 'X',
        author: 'X',
        coverUrl: 'x',
        description: 'x',
        category: 'X',
      })
      .expect(403);
  });

  it('POST /admin/books accepts admin user', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-pass' })
      .expect(200);
    const cookies = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
    await request(app.getHttpServer())
      .post('/admin/books')
      .set('Cookie', cookieHeader)
      .send({
        title: 'New Book',
        author: 'Author',
        coverUrl: 'https://covers/x',
        description: 'desc',
        category: 'Werewolf',
      })
      .expect(201);
  });

  it('POST /admin/books unauthenticated returns 401', async () => {
    await request(app.getHttpServer())
      .post('/admin/books')
      .send({
        title: 'X',
        author: 'X',
        coverUrl: 'x',
        description: 'x',
        category: 'X',
      })
      .expect(401);
  });
});
