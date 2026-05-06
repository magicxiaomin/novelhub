import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import {
  GOOGLE_OAUTH_CLIENT,
  PRISMA,
  SIGNUP_BONUS_COINS,
} from '../src/modules/auth/auth.constants';
import { EmailService } from '../src/modules/auth/email.service';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  coinBalance: number;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const buildPrismaStub = () => {
  const users = new Map<string, StoredUser>();
  let userIdCounter = 0;
  let txnIdCounter = 0;

  const findByEmail = (email: string) => {
    for (const u of users.values()) if (u.email === email) return u;
    return undefined;
  };
  const findByGoogle = (googleId: string) => {
    for (const u of users.values()) if (u.googleId === googleId) return u;
    return undefined;
  };

  const userClient = {
    findUnique: async ({ where }: { where: Record<string, string> }) => {
      if (where.id) return users.get(where.id) ?? null;
      if (where.email) return findByEmail(where.email) ?? null;
      if (where.googleId) return findByGoogle(where.googleId) ?? null;
      return null;
    },
    create: async ({ data }: { data: Partial<StoredUser> }) => {
      userIdCounter += 1;
      const id = `user-${userIdCounter}`;
      const now = new Date();
      const user: StoredUser = {
        id,
        email: data.email ?? '',
        passwordHash: data.passwordHash ?? null,
        googleId: data.googleId ?? null,
        coinBalance: data.coinBalance ?? 0,
        emailVerified: data.emailVerified ?? false,
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      users.set(id, user);
      return user;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<StoredUser> }) => {
      const user = users.get(where.id);
      if (!user) throw new Error('user not found');
      const updated = { ...user, ...data, updatedAt: new Date() };
      users.set(where.id, updated);
      return updated;
    },
  };

  const coinTransactionClient = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      txnIdCounter += 1;
      return { id: `txn-${txnIdCounter}`, ...data };
    },
  };

  const subscriptionClient = {
    findFirst: async () => null,
  };

  const tx = { user: userClient, coinTransaction: coinTransactionClient };

  return {
    user: userClient,
    coinTransaction: coinTransactionClient,
    subscription: subscriptionClient,
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  };
};

describe('Auth e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';
    process.env.GOOGLE_CLIENT_ID = 'e2e-google-client-id';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRISMA)
      .useValue(buildPrismaStub())
      .overrideProvider(EmailService)
      .useValue({
        sendWelcomeEmail: async () => undefined,
        sendPasswordResetEmail: async () => undefined,
      })
      .overrideProvider(GOOGLE_OAUTH_CLIENT)
      .useValue({
        verifyIdToken: async () => ({
          getPayload: () => ({
            sub: 'google-e2e',
            email: 'g@example.com',
            email_verified: true,
          }),
        }),
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

    // Sanity check: ensure AuthModule is loaded
    expect(moduleRef.get(AuthModule)).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, sets cookies, then GET /auth/me returns the user', async () => {
    const server = app.getHttpServer();

    const reg = await request(server)
      .post('/auth/register')
      .send({ email: 'luna@example.com', password: 'password123' })
      .expect(201);

    expect(reg.body.user.email).toBe('luna@example.com');
    expect(reg.body.user.coinBalance).toBe(SIGNUP_BONUS_COINS);
    const cookies = reg.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
    expect(cookieHeader).toMatch(/jwt=/);
    expect(cookieHeader).toMatch(/jwt_refresh=/);
    expect(cookieHeader).toMatch(/HttpOnly/i);

    const me = await request(server).get('/auth/me').set('Cookie', cookieHeader).expect(200);
    expect(me.body.user.email).toBe('luna@example.com');
    expect(me.body.user.hasActiveSubscription).toBe(false);
  });

  it('rejects duplicate registration with 409', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' })
      .expect(201);
    await request(server)
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' })
      .expect(409);
  });

  it('rejects login with wrong password (401)', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send({ email: 'wrong@example.com', password: 'password123' })
      .expect(201);
    await request(server)
      .post('/auth/login')
      .send({ email: 'wrong@example.com', password: 'badpass' })
      .expect(401);
  });

  it('rejects /auth/me without a cookie (401)', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects malformed register input via ValidationPipe (400)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
  });

  it('logout clears cookies', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send({ email: 'bye@example.com', password: 'password123' })
      .expect(201);
    const res = await request(server).post('/auth/logout').expect(200);
    const cookies = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
    expect(cookieHeader).toMatch(/jwt=;/);
    expect(cookieHeader).toMatch(/jwt_refresh=;/);
  });

  it('Google OAuth path returns isNewUser=true on first sign-in', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake' })
      .expect(200);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.user.email).toBe('g@example.com');
  });
});
