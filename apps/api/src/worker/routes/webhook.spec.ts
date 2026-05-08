import { Hono } from 'hono';
import Stripe from 'stripe';

import { DomainError } from '../../common/domain.errors';
import type { PrismaVariables } from '../db/prisma';
import type { PaymentsWorkerEnv } from '../services/payments-factory';
import { webhookRoutes } from './webhook';

const WEBHOOK_SECRET = 'whsec_worker_route_test';
const stripe = new Stripe('sk_test_worker_route', { apiVersion: '2025-02-24.acacia' });

type StoredWebhookEvent = {
  stripeEventId: string;
  eventType: string;
};

const buildPrismaStub = () => {
  const webhookEvents: StoredWebhookEvent[] = [];
  return {
    webhookEvents,
    prisma: {
      webhookEvent: {
        create: jest.fn(async ({ data }: { data: StoredWebhookEvent }) => {
          if (webhookEvents.some((event) => event.stripeEventId === data.stripeEventId)) {
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          webhookEvents.push(data);
          return data;
        }),
      },
    },
  };
};

const buildEventJson = (eventId: string): string =>
  JSON.stringify(
    {
      id: eventId,
      object: 'event',
      api_version: '2025-02-24.acacia',
      created: 1_778_198_400,
      data: { object: { id: 'cus_worker_route', object: 'customer' } },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: 'customer.created',
    },
    null,
    2,
  );

const sign = (payload: string, secret = WEBHOOK_SECRET): string =>
  stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000),
  });

const buildApp = (prisma: unknown) => {
  const app = new Hono<{ Bindings: PaymentsWorkerEnv; Variables: PrismaVariables }>();
  app.use('/payments/*', async (c, next) => {
    c.set('prisma', prisma as PrismaVariables['prisma']);
    await next();
  });
  app.route('/payments', webhookRoutes);
  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json({ statusCode: err.status, message: err.message }, err.status);
    }
    throw err;
  });
  return app;
};

describe('Worker payments webhook route', () => {
  let prismaStub: ReturnType<typeof buildPrismaStub>;
  let createSubtleCryptoProviderSpy: jest.SpiedFunction<typeof Stripe.createSubtleCryptoProvider>;

  beforeEach(() => {
    prismaStub = buildPrismaStub();
    createSubtleCryptoProviderSpy = jest.spyOn(Stripe, 'createSubtleCryptoProvider');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a valid signature with the raw bytes preserved end-to-end', async () => {
    const app = buildApp(prismaStub.prisma);
    const payload = buildEventJson('evt_worker_valid');

    const res = await app.request(
      '/payments/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': sign(payload),
        },
        body: new TextEncoder().encode(payload),
      },
      {
        STRIPE_SECRET_KEY: 'sk_test_worker_route',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      } as PaymentsWorkerEnv,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, type: 'customer.created' });
    expect(prismaStub.webhookEvents).toEqual([
      { stripeEventId: 'evt_worker_valid', eventType: 'customer.created' },
    ]);
    expect(createSubtleCryptoProviderSpy).toHaveBeenCalled();
  });

  it('rejects an invalid signature', async () => {
    const app = buildApp(prismaStub.prisma);
    const payload = buildEventJson('evt_worker_invalid');

    const res = await app.request(
      '/payments/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': sign(payload, 'whsec_wrong'),
        },
        body: new TextEncoder().encode(payload),
      },
      {
        STRIPE_SECRET_KEY: 'sk_test_worker_route',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      } as PaymentsWorkerEnv,
    );

    expect(res.status).toBe(400);
    expect(prismaStub.webhookEvents).toEqual([]);
  });

  it('rejects a missing signature header', async () => {
    const app = buildApp(prismaStub.prisma);

    const res = await app.request(
      '/payments/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: buildEventJson('evt_worker_missing_sig'),
      },
      {
        STRIPE_SECRET_KEY: 'sk_test_worker_route',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      } as PaymentsWorkerEnv,
    );

    expect(res.status).toBe(400);
    expect(prismaStub.webhookEvents).toEqual([]);
  });

  it('works without authentication cookies', async () => {
    const app = buildApp(prismaStub.prisma);
    const payload = buildEventJson('evt_worker_no_cookie');

    const res = await app.request(
      '/payments/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': sign(payload),
        },
        body: payload,
      },
      {
        STRIPE_SECRET_KEY: 'sk_test_worker_route',
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      } as PaymentsWorkerEnv,
    );

    expect(res.status).toBe(200);
    expect(prismaStub.webhookEvents).toHaveLength(1);
  });

  it('treats a duplicate Stripe event as an idempotent no-op', async () => {
    const app = buildApp(prismaStub.prisma);
    const payload = buildEventJson('evt_worker_duplicate');
    const signature = sign(payload);
    const env = {
      STRIPE_SECRET_KEY: 'sk_test_worker_route',
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    } as PaymentsWorkerEnv;

    const first = await app.request(
      '/payments/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signature,
        },
        body: payload,
      },
      env,
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      '/payments/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signature,
        },
        body: payload,
      },
      env,
    );

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      received: true,
      type: 'customer.created',
      duplicate: true,
    });
    expect(prismaStub.webhookEvents).toHaveLength(1);
  });
});
