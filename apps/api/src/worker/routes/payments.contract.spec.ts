import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeFbCapiService } from '../services/fb-capi-factory';
import { makePaymentsService, type PaymentsWorkerEnv } from '../services/payments-factory';
import { paymentsRoutes } from './payments';

jest.mock('../sentry', () => ({
  setSentryUser: jest.fn(),
}));

jest.mock('../services/payments-factory', () => ({
  makePaymentsService: jest.fn(),
}));

jest.mock('../services/fb-capi-factory', () => ({
  makeFbCapiService: jest.fn(),
}));

const mockedMakePaymentsService = jest.mocked(makePaymentsService);
const mockedMakeFbCapiService = jest.mocked(makeFbCapiService);

jest.mock(
  '@novelhub/shared',
  () => ({
    COIN_PACKAGE_IDS: ['pack_50', 'pack_120', 'pack_260', 'pack_700'],
    SUBSCRIPTION_PLAN_IDS: ['weekly', 'monthly'],
  }),
  { virtual: true },
);

const jwtSecret = 'payments-contract-secret';
const userId = '11111111-1111-4111-8111-111111111111';
const coinPackageId = 'pack_50';
const subscriptionPlanId = 'weekly';
const checkoutResult = { url: 'https://checkout.stripe.test/session', sessionId: 'cs_test_123' };
const portalResult = { url: 'https://billing.stripe.test/session' };
const subscriptionResult = {
  plan: subscriptionPlanId,
  status: 'active',
  currentPeriodEnd: '2026-06-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  canceledAt: null,
};
const orderResult = { status: 'pending', type: 'coin_purchase' };

const makeToken = (payload: JwtPayload, secret = jwtSecret) =>
  new JoseJwtClient(secret).signAsync(payload, { expiresIn: '15m' });

const makeCookie = (token: string) => `${COOKIE_ACCESS}=${token}`;

const buildPrisma = (
  user: { id: string; email: string; isAdmin: boolean } | null = {
    id: userId,
    email: 'reader@example.com',
    isAdmin: false,
  },
) =>
  ({
    user: {
      findUnique: jest.fn().mockResolvedValue(
        user
          ? {
              ...user,
              deletedAt: null,
              bannedAt: null,
            }
          : null,
      ),
    },
  }) as unknown as PrismaVariables['prisma'];

const buildApp = (prisma = buildPrisma()) => {
  const app = new Hono<{
    Bindings: PaymentsWorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();

  app.use('*', async (c, next) => {
    c.set('prisma', prisma);
    await next();
  });
  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        {
          statusCode: err.status,
          message: err.message,
          error: err.status === 400 ? 'Bad Request' : 'Error',
          ...(err.context ?? {}),
        },
        err.status,
      );
    }
    if (err instanceof HTTPException) {
      return c.json(
        {
          statusCode: err.status,
          message: err.message,
          error: err.status === 401 ? 'Unauthorized' : 'Error',
        },
        err.status,
      );
    }
    return c.json(
      { statusCode: 500, message: 'Internal Server Error', error: 'Internal Server Error' },
      500,
    );
  });
  app.route('/payments', paymentsRoutes);
  return app;
};

const env: PaymentsWorkerEnv = {
  JWT_SECRET: jwtSecret,
  NEXT_PUBLIC_APP_URL: 'https://novelhub.test',
};

describe('Worker payments route contracts', () => {
  const createCoinCheckout = jest.fn();
  const createSubscriptionCheckout = jest.fn();
  const createPortalSession = jest.fn();
  const getActiveSubscription = jest.fn();
  const getOrderStatus = jest.fn();
  const shouldSendForRequest = jest.fn();
  const extractFbUserData = jest.fn();

  beforeEach(() => {
    createCoinCheckout.mockResolvedValue(checkoutResult);
    createSubscriptionCheckout.mockResolvedValue(checkoutResult);
    createPortalSession.mockResolvedValue(portalResult);
    getActiveSubscription.mockResolvedValue(subscriptionResult);
    getOrderStatus.mockResolvedValue(orderResult);
    shouldSendForRequest.mockReturnValue(false);
    extractFbUserData.mockReturnValue({ fbp: 'fbp-test' });
    mockedMakePaymentsService.mockReturnValue({
      createCoinCheckout,
      createSubscriptionCheckout,
      createPortalSession,
      getActiveSubscription,
      getOrderStatus,
    } as unknown as ReturnType<typeof makePaymentsService>);
    mockedMakeFbCapiService.mockReturnValue({
      shouldSendForRequest,
      extractFbUserData,
    } as unknown as ReturnType<typeof makeFbCapiService>);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates a coin checkout session from a validated package DTO without live Stripe calls', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/payments/checkout/coins',
      {
        method: 'POST',
        headers: { cookie: makeCookie(token), 'content-type': 'application/json' },
        body: JSON.stringify({ packageId: coinPackageId }),
      },
      env,
    );

    expect(response.status).toBe(201);
    expect(createCoinCheckout).toHaveBeenCalledWith(userId, coinPackageId, {
      fbConsent: false,
      fbUserData: null,
    });
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(checkoutResult);
  });

  it('creates a subscription checkout session from a validated plan DTO', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/payments/checkout/subscription',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ plan: subscriptionPlanId }),
      },
      env,
    );

    expect(response.status).toBe(201);
    expect(createSubscriptionCheckout).toHaveBeenCalledWith(userId, subscriptionPlanId, {
      fbConsent: false,
      fbUserData: null,
    });
    expect(createCoinCheckout).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(checkoutResult);
  });

  it('passes consented FB attribution metadata through checkout routes without network access', async () => {
    shouldSendForRequest.mockReturnValueOnce(true);
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/payments/checkout/coins',
      {
        method: 'POST',
        headers: {
          cookie: `${makeCookie(token)}; fb_consent=granted; _fbp=fb.1.123`,
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.10',
          'user-agent': 'contract-test-agent',
        },
        body: JSON.stringify({ packageId: coinPackageId }),
      },
      env,
    );

    expect(response.status).toBe(201);
    expect(shouldSendForRequest).toHaveBeenCalledTimes(1);
    expect(extractFbUserData).toHaveBeenCalledTimes(1);
    expect(createCoinCheckout).toHaveBeenCalledWith(userId, coinPackageId, {
      fbConsent: true,
      fbUserData: { fbp: 'fbp-test' },
    });
  });

  it('returns read-only payment surfaces for portal, subscription, and order status', async () => {
    const app = buildApp();
    const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

    const [portal, subscription, order] = await Promise.all([
      app.request('/payments/portal', { headers: { cookie: makeCookie(token) } }, env),
      app.request('/payments/subscription', { headers: { cookie: makeCookie(token) } }, env),
      app.request('/payments/orders/cs_test_123', { headers: { cookie: makeCookie(token) } }, env),
    ]);

    expect(portal.status).toBe(200);
    expect(subscription.status).toBe(200);
    expect(order.status).toBe(200);
    expect(createPortalSession).toHaveBeenCalledWith(userId);
    expect(getActiveSubscription).toHaveBeenCalledWith(userId);
    expect(getOrderStatus).toHaveBeenCalledWith(userId, 'cs_test_123');
    expect(createCoinCheckout).not.toHaveBeenCalled();
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    await expect(portal.json()).resolves.toEqual(portalResult);
    await expect(subscription.json()).resolves.toEqual(subscriptionResult);
    await expect(order.json()).resolves.toEqual(orderResult);
  });

  it.each([
    ['coin checkout missing packageId', '/payments/checkout/coins', {}],
    ['coin checkout unknown packageId', '/payments/checkout/coins', { packageId: 'not-a-package' }],
    ['subscription checkout missing plan', '/payments/checkout/subscription', {}],
    ['subscription checkout unknown plan', '/payments/checkout/subscription', { plan: 'yearly' }],
  ] as const)(
    'returns 400 for %s without constructing payment or FB services',
    async (_name, path, body) => {
      const app = buildApp();
      const token = await makeToken({ sub: userId, email: 'reader@example.com', type: 'access' });

      const response = await app.request(
        path,
        {
          method: 'POST',
          headers: { cookie: makeCookie(token), 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
        env,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(mockedMakePaymentsService).not.toHaveBeenCalled();
      expect(mockedMakeFbCapiService).not.toHaveBeenCalled();
      expect(createCoinCheckout).not.toHaveBeenCalled();
      expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing token', undefined, buildPrisma()],
    [
      'invalid user',
      makeToken({ sub: userId, email: 'reader@example.com', type: 'access' }),
      buildPrisma(null),
    ],
    [
      'bad signature',
      makeToken({ sub: userId, email: 'reader@example.com', type: 'access' }, 'wrong-secret'),
      buildPrisma(),
    ],
  ])(
    'returns 401 for %s without constructing payment services',
    async (_name, tokenOrPromise, prisma) => {
      const app = buildApp(prisma);
      const token = tokenOrPromise ? await tokenOrPromise : undefined;

      const response = await app.request(
        '/payments/subscription',
        token ? { headers: { cookie: makeCookie(token) } } : undefined,
        env,
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Unauthorized',
      });
      expect(mockedMakePaymentsService).not.toHaveBeenCalled();
      expect(mockedMakeFbCapiService).not.toHaveBeenCalled();
      expect(getActiveSubscription).not.toHaveBeenCalled();
    },
  );
});
