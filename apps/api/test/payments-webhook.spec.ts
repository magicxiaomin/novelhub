import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { PassThrough } from 'node:stream';
import Stripe from 'stripe';

import { DomainErrorFilter } from '../src/common/domain-error.filter';
import { WebhookController } from '../src/modules/payments/webhook.controller';
import { WebhookService, type WebhookServiceDeps } from '../src/modules/payments/webhook.service';

const WEBHOOK_SECRET = 'whsec_route_test';
const stripe = new Stripe('sk_test_route', { apiVersion: '2025-02-24.acacia' });

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
      data: { object: { id: 'cus_route', object: 'customer' } },
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

const postWebhook = async (
  app: INestApplication,
  payload: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> => {
  const socket = new PassThrough() as unknown as Socket;
  const req = new IncomingMessage(socket);
  req.method = 'POST';
  req.url = '/payments/webhook';
  req.headers = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload).toString(),
    ...headers,
  };

  const res = new ServerResponse(req);
  const bodyChunks: Buffer[] = [];
  const finished = new Promise<{ status: number; body: unknown }>((resolve) => {
    res.write = ((chunk: Buffer | string): boolean => {
      bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    }) as ServerResponse['write'];
    res.end = ((
      chunk?: Buffer | string | (() => void),
      _encoding?: BufferEncoding | (() => void),
      callback?: () => void,
    ): ServerResponse => {
      if (Buffer.isBuffer(chunk) || typeof chunk === 'string') {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const cb =
        typeof chunk === 'function'
          ? chunk
          : typeof _encoding === 'function'
            ? _encoding
            : callback;
      cb?.();
      const bodyText = Buffer.concat(bodyChunks).toString('utf8');
      resolve({
        status: res.statusCode,
        body: bodyText ? (JSON.parse(bodyText) as unknown) : undefined,
      });
      return res;
    }) as ServerResponse['end'];
  });

  app.getHttpAdapter().getInstance()(req, res);
  req.push(payload);
  req.push(null);

  return finished;
};

describe('Payments webhook route e2e', () => {
  let app: INestApplication;
  let prismaStub: ReturnType<typeof buildPrismaStub>;

  beforeEach(async () => {
    prismaStub = buildPrismaStub();

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useFactory: () =>
            new WebhookService({
              prisma: prismaStub.prisma,
              stripe: { get: () => stripe },
              coins: {},
              purchasePublisher: {},
              webhookSecret: WEBHOOK_SECRET,
            } as unknown as WebhookServiceDeps),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a valid signature with the raw body preserved end-to-end', async () => {
    const payload = buildEventJson('evt_route_valid');

    const res = await postWebhook(app, payload, {
      'stripe-signature': sign(payload),
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, type: 'customer.created' });
    expect(prismaStub.webhookEvents).toEqual([
      { stripeEventId: 'evt_route_valid', eventType: 'customer.created' },
    ]);
  });

  it('rejects an invalid signature', async () => {
    const payload = buildEventJson('evt_route_invalid');

    const res = await postWebhook(app, payload, {
      'stripe-signature': sign(payload, 'whsec_wrong'),
    });

    expect(res.status).toBe(400);
    expect(prismaStub.webhookEvents).toEqual([]);
  });

  it('rejects a missing signature header', async () => {
    const res = await postWebhook(app, buildEventJson('evt_route_missing_sig'));

    expect(res.status).toBe(400);
    expect(prismaStub.webhookEvents).toEqual([]);
  });

  it('works without authentication cookies', async () => {
    const payload = buildEventJson('evt_route_no_cookie');

    const res = await postWebhook(app, payload, {
      'stripe-signature': sign(payload),
    });

    expect(res.status).toBe(200);
    expect(prismaStub.webhookEvents).toHaveLength(1);
  });

  it('treats a duplicate Stripe event as an idempotent no-op', async () => {
    const payload = buildEventJson('evt_route_duplicate');
    const signature = sign(payload);

    const first = await postWebhook(app, payload, {
      'stripe-signature': signature,
    });
    expect(first.status).toBe(200);

    const second = await postWebhook(app, payload, {
      'stripe-signature': signature,
    });

    expect(second.status).toBe(200);
    expect(second.body).toEqual({
      received: true,
      type: 'customer.created',
      duplicate: true,
    });
    expect(prismaStub.webhookEvents).toHaveLength(1);
  });
});
