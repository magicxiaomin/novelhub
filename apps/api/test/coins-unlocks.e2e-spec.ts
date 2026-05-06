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

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOOK_ID = '22222222-2222-4222-8222-222222222222';
const FREE_CHAPTER_ID = '33333333-3333-4333-8333-333333333333';
const PAID_CHAPTER_ID = '44444444-4444-4444-8444-444444444444';

const buildState = async () => {
  const passwordHash = await bcrypt.hash('user-pass', 4);
  type User = {
    id: string;
    email: string;
    passwordHash: string;
    coinBalance: number;
    isAdmin: boolean;
    deletedAt: Date | null;
  };
  type Chapter = {
    id: string;
    bookId: string;
    isFree: boolean;
    contentUrl: string;
    order: number;
    deletedAt: Date | null;
  };
  type Book = {
    id: string;
    coinPerChapter: number;
    deletedAt: Date | null;
  };
  type Unlock = {
    id: string;
    userId: string;
    chapterId: string;
    method: string;
    unlockedAt: Date;
  };
  type Txn = {
    id: string;
    userId: string;
    amount: number;
    type: string;
    relatedId: string | null;
    balanceAfter: number;
    createdAt: Date;
  };

  return {
    users: new Map<string, User>([
      [
        USER_ID,
        {
          id: USER_ID,
          email: 'user@example.com',
          passwordHash,
          coinBalance: 50,
          isAdmin: false,
          deletedAt: null,
        },
      ],
    ]),
    books: [{ id: BOOK_ID, coinPerChapter: 5, deletedAt: null } as Book],
    chapters: [
      {
        id: FREE_CHAPTER_ID,
        bookId: BOOK_ID,
        isFree: true,
        contentUrl: 'free.txt',
        order: 1,
        deletedAt: null,
      } as Chapter,
      {
        id: PAID_CHAPTER_ID,
        bookId: BOOK_ID,
        isFree: false,
        contentUrl: 'paid.txt',
        order: 2,
        deletedAt: null,
      } as Chapter,
    ],
    unlocks: [] as Unlock[],
    txns: [] as Txn[],
    txnCounter: 0,
    unlockCounter: 0,
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
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          deletedAt?: null;
          coinBalance?: { gte?: number };
        };
        data: { coinBalance: { increment: number } };
      }) => {
        const u = state.users.get(where.id);
        if (!u || u.deletedAt) return { count: 0 };
        if (where.coinBalance?.gte !== undefined) {
          if (u.coinBalance < where.coinBalance.gte) return { count: 0 };
        }
        u.coinBalance += data.coinBalance.increment;
        return { count: 1 };
      },
      create: async () => {
        throw new Error('user.create not used');
      },
      update: async () => {
        throw new Error('user.update not used');
      },
    },
    book: {
      findFirst: async ({ where }: { where: { id: string } }) => {
        const b = findBook(where.id);
        if (!b || b.deletedAt) return null;
        return b;
      },
      findMany: async () => state.books.filter((b) => !b.deletedAt),
      count: async () => state.books.filter((b) => !b.deletedAt).length,
      groupBy: async () => [],
    },
    chapter: {
      findFirst: async ({ where }: { where: { id: string } }) => {
        const c = findChapter(where.id);
        if (!c || c.deletedAt) return null;
        const book = findBook(c.bookId);
        return { ...c, book };
      },
      findUnique: async ({ where }: { where: { id: string } }) => findChapter(where.id),
    },
    chapterUnlock: {
      findUnique: async ({
        where,
      }: {
        where: { userId_chapterId: { userId: string; chapterId: string } };
      }) =>
        state.unlocks.find(
          (u) =>
            u.userId === where.userId_chapterId.userId &&
            u.chapterId === where.userId_chapterId.chapterId,
        ) ?? null,
      create: async ({ data }: { data: { userId: string; chapterId: string; method: string } }) => {
        if (state.unlocks.some((u) => u.userId === data.userId && u.chapterId === data.chapterId)) {
          const err = new Error('unique constraint failed') as Error & {
            code: string;
          };
          err.code = 'P2002';
          throw err;
        }
        state.unlockCounter += 1;
        const u = {
          id: `unlock-${state.unlockCounter}`,
          unlockedAt: new Date(),
          ...data,
        };
        state.unlocks.push(u);
        return u;
      },
      findMany: async ({
        where,
        skip = 0,
        take = 100,
      }: {
        where: { userId: string };
        skip?: number;
        take?: number;
      }) => state.unlocks.filter((u) => u.userId === where.userId).slice(skip, skip + take),
      count: async ({ where }: { where: { userId: string } }) =>
        state.unlocks.filter((u) => u.userId === where.userId).length,
    },
    coinTransaction: {
      create: async ({
        data,
        select,
      }: {
        data: Omit<
          {
            userId: string;
            amount: number;
            type: string;
            relatedId: string | null;
            balanceAfter: number;
          },
          never
        >;
        select?: { id: boolean };
      }) => {
        state.txnCounter += 1;
        const t = {
          id: `txn-${state.txnCounter}`,
          createdAt: new Date(),
          ...data,
          relatedId: data.relatedId ?? null,
        };
        state.txns.push(t);
        return select?.id ? { id: t.id } : t;
      },
      findMany: async ({
        where,
        skip = 0,
        take = 100,
      }: {
        where: { userId: string };
        skip?: number;
        take?: number;
      }) =>
        state.txns
          .filter((t) => t.userId === where.userId)
          .slice(skip, skip + take)
          .map((t) => ({
            id: t.id,
            amount: t.amount,
            type: t.type,
            relatedId: t.relatedId,
            balanceAfter: t.balanceAfter,
            createdAt: t.createdAt,
          })),
      count: async ({ where }: { where: { userId: string } }) =>
        state.txns.filter((t) => t.userId === where.userId).length,
    },
    subscription: {
      findFirst: async () => null,
    },
    $transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
      cb({
        user: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            state.users.get(where.id) ?? null,
          updateMany: async ({
            where,
            data,
          }: {
            where: {
              id: string;
              deletedAt?: null;
              coinBalance?: { gte?: number };
            };
            data: { coinBalance: { increment: number } };
          }) => {
            const u = state.users.get(where.id);
            if (!u || u.deletedAt) return { count: 0 };
            if (where.coinBalance?.gte !== undefined) {
              if (u.coinBalance < where.coinBalance.gte) return { count: 0 };
            }
            u.coinBalance += data.coinBalance.increment;
            return { count: 1 };
          },
        },
        coinTransaction: {
          create: async ({
            data,
            select,
          }: {
            data: {
              userId: string;
              amount: number;
              type: string;
              relatedId: string | null;
              balanceAfter: number;
            };
            select?: { id: boolean };
          }) => {
            state.txnCounter += 1;
            const t = {
              id: `txn-${state.txnCounter}`,
              createdAt: new Date(),
              ...data,
              relatedId: data.relatedId ?? null,
            };
            state.txns.push(t);
            return select?.id ? { id: t.id } : t;
          },
        },
        chapterUnlock: {
          create: async ({
            data,
          }: {
            data: { userId: string; chapterId: string; method: string };
          }) => {
            if (
              state.unlocks.some((u) => u.userId === data.userId && u.chapterId === data.chapterId)
            ) {
              const err = new Error('unique constraint failed') as Error & {
                code: string;
              };
              err.code = 'P2002';
              throw err;
            }
            state.unlockCounter += 1;
            const u = {
              id: `unlock-${state.unlockCounter}`,
              unlockedAt: new Date(),
              ...data,
            };
            state.unlocks.push(u);
            return u;
          },
        },
      }),
  };
};

describe('Coins + Unlocks e2e', () => {
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
        getText: async () => 'preview text',
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

  const login = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'user-pass' })
      .expect(200);
    const cookies = res.headers['set-cookie'];
    return Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
  };

  it('GET /coins/balance returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/coins/balance').expect(401);
  });

  it('GET /coins/balance returns the user’s balance', async () => {
    const cookie = await login();
    const res = await request(app.getHttpServer())
      .get('/coins/balance')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.coinBalance).toBeGreaterThanOrEqual(0);
  });

  it('POST /unlocks/chapter/:id unlocks paid chapter and debits coins', async () => {
    const cookie = await login();
    const before = await request(app.getHttpServer())
      .get('/coins/balance')
      .set('Cookie', cookie)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/unlocks/chapter/${PAID_CHAPTER_ID}`)
      .set('Cookie', cookie)
      .expect(201);
    expect(res.body.method).toBe('COINS');
    expect(res.body.bookId).toBe(BOOK_ID);

    const after = await request(app.getHttpServer())
      .get('/coins/balance')
      .set('Cookie', cookie)
      .expect(200);
    expect(after.body.coinBalance).toBe(before.body.coinBalance - 5);

    // Idempotent — calling again does not debit further
    const repeat = await request(app.getHttpServer())
      .post(`/unlocks/chapter/${PAID_CHAPTER_ID}`)
      .set('Cookie', cookie)
      .expect(201);
    expect(repeat.body.method).toBe('COINS');

    const afterRepeat = await request(app.getHttpServer())
      .get('/coins/balance')
      .set('Cookie', cookie)
      .expect(200);
    expect(afterRepeat.body.coinBalance).toBe(after.body.coinBalance);
  });

  it('GET /unlocks lists the user’s unlocked chapters', async () => {
    const cookie = await login();
    const res = await request(app.getHttpServer())
      .get('/unlocks')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items[0].chapterId).toBe(PAID_CHAPTER_ID);
  });

  it('POST /unlocks/chapter/:id on a free chapter returns 400', async () => {
    const cookie = await login();
    await request(app.getHttpServer())
      .post(`/unlocks/chapter/${FREE_CHAPTER_ID}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('POST /unlocks/chapter/:id without auth returns 401', async () => {
    await request(app.getHttpServer()).post(`/unlocks/chapter/${PAID_CHAPTER_ID}`).expect(401);
  });

  it('GET /coins/transactions returns the unlock txn', async () => {
    const cookie = await login();
    const res = await request(app.getHttpServer())
      .get('/coins/transactions')
      .set('Cookie', cookie)
      .expect(200);
    const unlockTxn = res.body.items.find(
      (t: { type: string; relatedId: string }) =>
        t.type === 'CHAPTER_UNLOCK' && t.relatedId === PAID_CHAPTER_ID,
    );
    expect(unlockTxn).toBeDefined();
    expect(unlockTxn.amount).toBe(-5);
  });
});
