import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';

import { GOOGLE_OAUTH_CLIENT, PRISMA, SIGNUP_BONUS_COINS } from './auth.constants';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { FbCapiService } from '../fb-capi/fb-capi.service';
import { STRIPE_CLIENT } from '../payments/stripe.constants';

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

type CoinTxn = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  balanceAfter: number;
};

type StoredSubscription = {
  id: string;
  userId: string;
  status: string;
  stripeSubscriptionId: string;
};

const makePrismaStub = () => {
  const users = new Map<string, StoredUser>();
  const subscriptions: StoredSubscription[] = [];
  const coinTxns: CoinTxn[] = [];
  let userIdCounter = 0;
  let txnIdCounter = 0;

  const findByEmail = (email: string): StoredUser | undefined => {
    for (const u of users.values()) if (u.email === email) return u;
    return undefined;
  };
  const findByGoogle = (googleId: string): StoredUser | undefined => {
    for (const u of users.values()) if (u.googleId === googleId) return u;
    return undefined;
  };

  const userClient = {
    findUnique: jest.fn(async ({ where }: { where: Record<string, string> }) => {
      if (where.id) return users.get(where.id) ?? null;
      if (where.email) return findByEmail(where.email) ?? null;
      if (where.googleId) return findByGoogle(where.googleId) ?? null;
      return null;
    }),
    create: jest.fn(async ({ data }: { data: Partial<StoredUser> }) => {
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
    }),
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<StoredUser> }) => {
        const user = users.get(where.id);
        if (!user) throw new Error('user not found');
        const updated = { ...user, ...data, updatedAt: new Date() };
        users.set(where.id, updated);
        return updated;
      },
    ),
  };

  const coinTransactionClient = {
    create: jest.fn(async ({ data }: { data: Omit<CoinTxn, 'id'> }) => {
      txnIdCounter += 1;
      const txn: CoinTxn = { id: `txn-${txnIdCounter}`, ...data };
      coinTxns.push(txn);
      return txn;
    }),
  };

  const subscriptionClient = {
    findFirst: jest.fn(async () => null),
    findMany: jest.fn(async ({ where }: { where: { userId: string; status: { in: string[] } } }) =>
      subscriptions.filter(
        (sub) => sub.userId === where.userId && where.status.in.includes(sub.status),
      ),
    ),
  };

  const tx = {
    user: userClient,
    coinTransaction: coinTransactionClient,
  };

  const prisma = {
    user: userClient,
    coinTransaction: coinTransactionClient,
    subscription: subscriptionClient,
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { prisma, users, subscriptions, coinTxns };
};

const makeEmailStub = () => ({
  sendWelcomeEmail: jest.fn(async (): Promise<void> => undefined),
  sendPasswordResetEmail: jest.fn(async (): Promise<void> => undefined),
});

const makeGoogleStub = () => ({
  verifyIdToken: jest.fn(),
});

const makeStripeStub = () => {
  const stripe = {
    subscriptions: {
      cancel: jest.fn(async () => ({})),
    },
  };
  return {
    stripe,
    get: jest.fn(() => stripe),
  };
};

const makeFbCapiStub = () => ({
  sendEvent: jest.fn(async (): Promise<void> => undefined),
});

describe('AuthService', () => {
  const ORIGINAL_ENV = { ...process.env };
  let service: AuthService;
  let prismaStub: ReturnType<typeof makePrismaStub>;
  let emailStub: ReturnType<typeof makeEmailStub>;
  let googleStub: ReturnType<typeof makeGoogleStub>;
  let stripeStub: ReturnType<typeof makeStripeStub>;
  let fbCapiStub: ReturnType<typeof makeFbCapiStub>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_RESET_SECRET = 'test-reset-secret';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client';

    prismaStub = makePrismaStub();
    emailStub = makeEmailStub();
    googleStub = makeGoogleStub();
    stripeStub = makeStripeStub();
    fbCapiStub = makeFbCapiStub();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PRISMA, useValue: prismaStub.prisma },
        { provide: EmailService, useValue: emailStub },
        { provide: GOOGLE_OAUTH_CLIENT, useValue: googleStub },
        { provide: STRIPE_CLIENT, useValue: stripeStub },
        { provide: FbCapiService, useValue: fbCapiStub },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('register: creates user, awards 20-coin bonus, sends welcome email', async () => {
    const result = await service.register('Luna@Example.com', 'password123');
    expect(result.user.email).toBe('luna@example.com');
    expect(result.user.coinBalance).toBe(SIGNUP_BONUS_COINS);
    expect(result.user.hasPassword).toBe(true);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
    expect(prismaStub.coinTxns).toHaveLength(1);
    expect(prismaStub.coinTxns[0]).toMatchObject({
      amount: SIGNUP_BONUS_COINS,
      balanceAfter: SIGNUP_BONUS_COINS,
      type: 'SIGNUP_BONUS',
    });
    expect(emailStub.sendWelcomeEmail).toHaveBeenCalledWith('luna@example.com');
  });

  it('register: rejects duplicate email with 409', async () => {
    await service.register('luna@example.com', 'password123');
    await expect(service.register('luna@example.com', 'password456')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login: returns user on correct password', async () => {
    await service.register('luna@example.com', 'password123');
    const result = await service.login('luna@example.com', 'password123');
    expect(result.user.email).toBe('luna@example.com');
    expect(result.tokens.accessToken).toBeTruthy();
  });

  it('login: 401 on wrong password', async () => {
    await service.register('luna@example.com', 'password123');
    await expect(service.login('luna@example.com', 'wrongpass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login: 401 on unknown email (no leak)', async () => {
    await expect(service.login('ghost@example.com', 'whatever')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login: 401 when user is soft-deleted', async () => {
    await service.register('luna@example.com', 'password123');
    const onlyUser = Array.from(prismaStub.users.values())[0];
    if (!onlyUser) throw new Error('no user created');
    onlyUser.deletedAt = new Date();
    await expect(service.login('luna@example.com', 'password123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('google: new user gets bonus, isNewUser=true', async () => {
    googleStub.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-123',
        email: 'NEW@example.com',
        email_verified: true,
      }),
    });
    const result = await service.loginWithGoogle('fake-id-token');
    expect(result.isNewUser).toBe(true);
    expect(result.user.email).toBe('new@example.com');
    expect(result.user.coinBalance).toBe(SIGNUP_BONUS_COINS);
    expect(result.user.hasPassword).toBe(false);
    expect(emailStub.sendWelcomeEmail).toHaveBeenCalled();
  });

  it('google: existing email links googleId without double bonus', async () => {
    await service.register('linkme@example.com', 'password123');
    expect(prismaStub.coinTxns).toHaveLength(1);
    googleStub.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-456',
        email: 'linkme@example.com',
        email_verified: true,
      }),
    });
    const result = await service.loginWithGoogle('fake');
    expect(result.isNewUser).toBe(false);
    expect(prismaStub.coinTxns).toHaveLength(1);
  });

  it('google: rejects unverified email', async () => {
    googleStub.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-789',
        email: 'unverified@example.com',
        email_verified: false,
      }),
    });
    await expect(service.loginWithGoogle('fake')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('google: 401 when verifyIdToken throws', async () => {
    googleStub.verifyIdToken.mockRejectedValue(new Error('bad token'));
    await expect(service.loginWithGoogle('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh: issues fresh tokens for valid refresh JWT', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    const fresh = await service.refresh(reg.tokens.refreshToken);
    expect(fresh.accessToken).toBeTruthy();
    expect(fresh.refreshToken).toBeTruthy();
  });

  it('refresh: rejects access token used as refresh token', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    await expect(service.refresh(reg.tokens.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refresh: rejects garbage', async () => {
    await expect(service.refresh('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forgot-password: silent on unknown email, sends email when found', async () => {
    await service.forgotPassword('ghost@example.com');
    expect(emailStub.sendPasswordResetEmail).not.toHaveBeenCalled();

    await service.register('luna@example.com', 'password123');
    await service.forgotPassword('luna@example.com');
    // give the fire-and-forget a tick
    await new Promise((resolve) => setImmediate(resolve));
    expect(emailStub.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('reset-password: updates the password hash', async () => {
    const reg = await service.register('luna@example.com', 'oldpassword');
    // mint a reset token directly via the service's JwtService for determinism
    const jwt = new JwtService();
    const token = await jwt.signAsync(
      { sub: reg.user.id, type: 'reset' },
      { secret: 'test-reset-secret', expiresIn: '1h' },
    );
    await service.resetPassword(token, 'newpassword');
    const stored = Array.from(prismaStub.users.values())[0];
    if (!stored?.passwordHash) throw new Error('no password hash');
    expect(await bcrypt.compare('newpassword', stored.passwordHash)).toBe(true);
    expect(await bcrypt.compare('oldpassword', stored.passwordHash)).toBe(false);
  });

  it('reset-password: rejects an access token used as reset token', async () => {
    const reg = await service.register('luna@example.com', 'oldpassword');
    await expect(
      service.resetPassword(reg.tokens.accessToken, 'newpassword'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reset-password: rejects garbage', async () => {
    await expect(service.resetPassword('not-a-jwt', 'newpassword')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getCurrentUser: returns user with hasActiveSubscription false by default', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    const user = await service.getCurrentUser(reg.user.id);
    expect(user.email).toBe('luna@example.com');
    expect(user.hasActiveSubscription).toBe(false);
  });

  it('getCurrentUser: 401 for soft-deleted user', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    const stored = Array.from(prismaStub.users.values())[0];
    if (!stored) throw new Error('no user');
    stored.deletedAt = new Date();
    await expect(service.getCurrentUser(reg.user.id)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deleteAccount: soft-deletes an active user', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    await service.deleteAccount(reg.user.id, 'password123');
    expect(prismaStub.users.get(reg.user.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it('deleteAccount: 401 on invalid password', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    await expect(service.deleteAccount(reg.user.id, 'wrongpass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deleteAccount: soft-deletes a Google-only user without password check', async () => {
    googleStub.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-delete',
        email: 'google-delete@example.com',
        email_verified: true,
      }),
    });
    const result = await service.loginWithGoogle('fake-id-token');

    await service.deleteAccount(result.user.id, '');

    expect(prismaStub.users.get(result.user.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it('deleteAccount: returns success for an already-deleted user', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    const stored = prismaStub.users.get(reg.user.id);
    if (!stored) throw new Error('no user');
    stored.deletedAt = new Date();
    await expect(service.deleteAccount(reg.user.id, 'password123')).resolves.toBeUndefined();
  });

  it('deleteAccount: cancels active Stripe subscriptions before soft-delete', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    prismaStub.subscriptions.push({
      id: 'sub-1',
      userId: reg.user.id,
      status: 'active',
      stripeSubscriptionId: 'stripe-sub-1',
    });
    prismaStub.subscriptions.push({
      id: 'sub-2',
      userId: reg.user.id,
      status: 'expired',
      stripeSubscriptionId: 'stripe-sub-2',
    });

    await service.deleteAccount(reg.user.id, 'password123');

    expect(stripeStub.stripe.subscriptions.cancel).toHaveBeenCalledWith('stripe-sub-1');
    expect(stripeStub.stripe.subscriptions.cancel).not.toHaveBeenCalledWith('stripe-sub-2');
  });

  it('deleteAccount: treats missing Stripe subscription as already canceled', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    prismaStub.subscriptions.push({
      id: 'sub-1',
      userId: reg.user.id,
      status: 'active',
      stripeSubscriptionId: 'stripe-sub-missing',
    });
    stripeStub.stripe.subscriptions.cancel.mockRejectedValueOnce({
      code: 'resource_missing',
      type: 'StripeInvalidRequestError',
    });

    await expect(service.deleteAccount(reg.user.id, 'password123')).resolves.toBeUndefined();

    expect(stripeStub.stripe.subscriptions.cancel).toHaveBeenCalledWith('stripe-sub-missing');
    expect(prismaStub.users.get(reg.user.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it('deleteAccount: does not soft-delete when Stripe cancellation fails', async () => {
    const reg = await service.register('luna@example.com', 'password123');
    prismaStub.subscriptions.push({
      id: 'sub-1',
      userId: reg.user.id,
      status: 'active',
      stripeSubscriptionId: 'stripe-sub-1',
    });
    stripeStub.stripe.subscriptions.cancel.mockRejectedValueOnce(new Error('stripe unavailable'));

    await expect(service.deleteAccount(reg.user.id, 'password123')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prismaStub.users.get(reg.user.id)?.deletedAt).toBeNull();
  });
});
