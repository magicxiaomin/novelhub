import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ORDER_TYPE } from '@novelhub/shared';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { CoinsService } from '../coins/coins.service';

import { PURCHASE_EVENT_PUBLISHER, type PurchaseCompletedEvent } from './purchase-event.publisher';
import { STRIPE_CLIENT } from './stripe.constants';
import { WebhookService } from './webhook.service';

type FakeOrder = {
  id: string;
  userId: string;
  stripeSessionId: string;
  stripePaymentIntent: string | null;
  type: string;
  amount: number;
  currency: string;
  coinsGranted: number | null;
  status: string;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
};

type FakeUser = {
  id: string;
  coinBalance: number;
  stripeCustomerId: string | null;
  deletedAt: Date | null;
};

type FakeSubscription = {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
};

type FakeWebhookEvent = { stripeEventId: string; eventType: string };

const buildPrismaStub = (state: {
  users: FakeUser[];
  orders: FakeOrder[];
  subs: FakeSubscription[];
  webhookEvents: FakeWebhookEvent[];
}) => {
  const usersById = new Map(state.users.map((u) => [u.id, u]));

  const orderClient = {
    findUnique: async ({
      where,
    }: {
      where: { stripeSessionId?: string; stripePaymentIntent?: string };
    }) => {
      if (where.stripeSessionId) {
        return state.orders.find((o) => o.stripeSessionId === where.stripeSessionId) ?? null;
      }
      if (where.stripePaymentIntent) {
        return (
          state.orders.find((o) => o.stripePaymentIntent === where.stripePaymentIntent) ?? null
        );
      }
      return null;
    },
    create: async ({ data }: { data: Omit<FakeOrder, 'id'> }) => {
      const o: FakeOrder = { id: `order-${state.orders.length + 1}`, ...data };
      state.orders.push(o);
      return o;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        stripeSessionId?: string;
        id?: string;
        status?: string;
      };
      data: Partial<FakeOrder>;
    }) => {
      let count = 0;
      for (const o of state.orders) {
        const idMatch = where.id ? o.id === where.id : true;
        const sessionMatch = where.stripeSessionId
          ? o.stripeSessionId === where.stripeSessionId
          : true;
        const statusMatch = where.status ? o.status === where.status : true;
        if (idMatch && sessionMatch && statusMatch) {
          Object.assign(o, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  const subscriptionClient = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { stripeSubscriptionId: string };
      create: FakeSubscription;
      update: Partial<FakeSubscription>;
    }) => {
      const existing = state.subs.find(
        (s) => s.stripeSubscriptionId === where.stripeSubscriptionId,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      state.subs.push(create);
      return create;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { stripeSubscriptionId: string };
      data: Partial<FakeSubscription>;
    }) => {
      let count = 0;
      for (const s of state.subs) {
        if (s.stripeSubscriptionId === where.stripeSubscriptionId) {
          Object.assign(s, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  const userClient = {
    findUnique: async ({ where }: { where: { id: string } }) => usersById.get(where.id) ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        id: string;
        deletedAt?: null;
        coinBalance?: { gte?: number };
        stripeCustomerId?: string | null;
      };
      data: { coinBalance?: { increment: number }; stripeCustomerId?: string };
    }) => {
      const u = usersById.get(where.id);
      if (!u || u.deletedAt) return { count: 0 };
      if (where.coinBalance?.gte !== undefined) {
        if (u.coinBalance < where.coinBalance.gte) return { count: 0 };
      }
      if (where.stripeCustomerId === null && u.stripeCustomerId !== null) {
        return { count: 0 };
      }
      if (data.coinBalance) {
        u.coinBalance += data.coinBalance.increment;
      }
      if (data.stripeCustomerId !== undefined) {
        u.stripeCustomerId = data.stripeCustomerId;
      }
      return { count: 1 };
    },
  };

  const coinTransactionClient = {
    create: async () => ({ id: `txn-${Math.random()}` }),
  };

  const webhookEventClient = {
    create: async ({ data }: { data: FakeWebhookEvent }) => {
      const dup = state.webhookEvents.find((e) => e.stripeEventId === data.stripeEventId);
      if (dup) {
        // Mimic Prisma's P2002 unique-violation shape so the service's
        // duck-typed isUniqueViolation() picks it up.
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      state.webhookEvents.push(data);
      return data;
    },
  };

  type PrismaShape = {
    order: typeof orderClient;
    subscription: typeof subscriptionClient;
    user: typeof userClient;
    coinTransaction: typeof coinTransactionClient;
    webhookEvent: typeof webhookEventClient;
    $transaction: <T>(cb: (tx: PrismaShape) => Promise<T>) => Promise<T>;
  };
  const prisma: PrismaShape = {
    order: orderClient,
    subscription: subscriptionClient,
    user: userClient,
    coinTransaction: coinTransactionClient,
    webhookEvent: webhookEventClient,
    $transaction: async (cb) => cb(prisma),
  };
  return prisma;
};

const buildStripeStub = (buildEvent: (raw: Buffer, sig: string, secret: string) => unknown) => ({
  get: () => ({
    webhooks: {
      constructEvent: (raw: Buffer, sig: string, secret: string) => buildEvent(raw, sig, secret),
    },
  }),
});

const buildPublisherStub = () => {
  const events: PurchaseCompletedEvent[] = [];
  return {
    publisher: {
      publish: async (e: PurchaseCompletedEvent) => {
        events.push(e);
      },
    },
    events,
  };
};

describe('WebhookService', () => {
  const buildService = async (
    state: ReturnType<typeof buildState>,
    eventBuilder: () => unknown,
  ): Promise<{
    service: WebhookService;
    state: typeof state;
    publishedEvents: PurchaseCompletedEvent[];
  }> => {
    const prisma = buildPrismaStub(state);
    const stripe = buildStripeStub(() => eventBuilder());
    const publisher = buildPublisherStub();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: CoinsService,
          useFactory: (p: PrismaClient): CoinsService => new CoinsService({ prisma: p }),
          inject: [PRISMA],
        },
        { provide: PRISMA, useValue: prisma },
        { provide: STRIPE_CLIENT, useValue: stripe },
        { provide: PURCHASE_EVENT_PUBLISHER, useValue: publisher.publisher },
      ],
    }).compile();
    return {
      service: module.get(WebhookService),
      state,
      publishedEvents: publisher.events,
    };
  };

  const buildState = () => ({
    users: [
      { id: 'user-1', coinBalance: 0, stripeCustomerId: null, deletedAt: null },
    ] as FakeUser[],
    orders: [] as FakeOrder[],
    subs: [] as FakeSubscription[],
    webhookEvents: [] as FakeWebhookEvent[],
  });

  it('rejects requests without a signature header', async () => {
    const { service } = await buildService(buildState(), () => {
      throw new Error('should not be called');
    });
    await expect(service.handleEvent(Buffer.from('{}'), undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when constructEvent throws (bad signature)', async () => {
    const { service } = await buildService(buildState(), () => {
      throw new Error('Webhook signature verification failed');
    });
    await expect(service.handleEvent(Buffer.from('{}'), 'whsec_garbage')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('checkout.session.completed (coin order, pre-existing pending Order): grants coins, marks completed, publishes purchase event, captures Stripe customer', async () => {
    const state = buildState();
    state.orders.push({
      id: 'order-1',
      userId: 'user-1',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntent: null,
      type: 'COIN_PURCHASE',
      amount: 999,
      currency: 'usd',
      coinsGranted: 120,
      status: 'pending',
      completedAt: null,
      metadata: { packageId: 'pack_120' },
    });
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          customer: 'cus_test_1',
          metadata: {
            userId: 'user-1',
            orderType: 'COIN_PURCHASE',
            packageId: 'pack_120',
          },
          payment_intent: 'pi_test_1',
          amount_total: 999,
          currency: 'usd',
        },
      },
    };
    const { service, publishedEvents } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');

    expect(state.users[0]?.coinBalance).toBe(120);
    expect(state.users[0]?.stripeCustomerId).toBe('cus_test_1');
    expect(state.orders[0]?.status).toBe('completed');
    expect(state.orders[0]?.stripePaymentIntent).toBe('pi_test_1');
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0]).toMatchObject({
      userId: 'user-1',
      orderType: 'COIN_PURCHASE',
      coinsGranted: 120,
      stripeSessionId: 'cs_test_1',
    });
  });

  it('duplicate event.id is short-circuited at the WebhookEvent gate (no double grant, no extra publish)', async () => {
    const state = buildState();
    state.orders.push({
      id: 'order-1',
      userId: 'user-1',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntent: null,
      type: 'COIN_PURCHASE',
      amount: 999,
      currency: 'usd',
      coinsGranted: 120,
      status: 'pending',
      completedAt: null,
      metadata: { packageId: 'pack_120' },
    });
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          customer: 'cus_test_1',
          metadata: {
            userId: 'user-1',
            orderType: 'COIN_PURCHASE',
            packageId: 'pack_120',
          },
          payment_intent: 'pi_test_1',
          amount_total: 999,
          currency: 'usd',
        },
      },
    };
    const { service, publishedEvents } = await buildService(state, () => event);
    const first = await service.handleEvent(Buffer.from('{}'), 'sig');
    const second = await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(first.duplicate).toBeUndefined();
    expect(second.duplicate).toBe(true);
    expect(state.users[0]?.coinBalance).toBe(120);
    expect(publishedEvents).toHaveLength(1);
  });

  it('checkout.session.completed (coin order, no pre-Order): recovers from packageId metadata, creates completed Order, grants coins atomically, publishes', async () => {
    const state = buildState();
    const event = {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_recover_1',
          customer: 'cus_recover_1',
          metadata: {
            userId: 'user-1',
            orderType: 'COIN_PURCHASE',
            packageId: 'pack_50',
          },
          payment_intent: 'pi_recover_1',
          amount_total: 499,
          currency: 'usd',
        },
      },
    };
    const { service, publishedEvents } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0]?.status).toBe('completed');
    expect(state.orders[0]?.coinsGranted).toBe(50);
    expect(state.orders[0]?.metadata).toMatchObject({ recovered: true });
    expect(state.users[0]?.coinBalance).toBe(50);
    expect(publishedEvents[0]).toMatchObject({
      orderType: 'COIN_PURCHASE',
      coinsGranted: 50,
      amountMinor: 499,
    });
  });

  it('checkout.session.completed (subscription order): marks completed and publishes Subscribe purchase event from Order amounts', async () => {
    const state = buildState();
    state.orders.push({
      id: 'order-sub-1',
      userId: 'user-1',
      stripeSessionId: 'cs_sub_1',
      stripePaymentIntent: null,
      type: ORDER_TYPE.SUBSCRIPTION,
      amount: 1299,
      currency: 'usd',
      coinsGranted: null,
      status: 'pending',
      completedAt: null,
      metadata: { planId: 'weekly' },
    });
    const event = {
      id: 'evt_sub_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sub_1',
          customer: 'cus_sub_1',
          metadata: {
            userId: 'user-1',
            orderType: ORDER_TYPE.SUBSCRIPTION,
            planId: 'weekly',
          },
          amount_total: 1299,
          currency: 'usd',
        },
      },
    };
    const { service, publishedEvents } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');

    expect(state.orders[0]?.status).toBe('completed');
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0]).toMatchObject({
      userId: 'user-1',
      orderId: 'order-sub-1',
      orderType: ORDER_TYPE.SUBSCRIPTION,
      amountMinor: 1299,
      currency: 'usd',
      coinsGranted: null,
      stripeSessionId: 'cs_sub_1',
    });
  });

  it('customer.subscription.created: upserts a Subscription row and caches Stripe customer on User', async () => {
    const state = buildState();
    const event = {
      id: 'evt_sub_1',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_test_1',
          customer: 'cus_test_1',
          status: 'active',
          metadata: { userId: 'user-1', planId: 'weekly' },
          items: { data: [{ price: { id: 'price_weekly_test' } }] },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 7 * 86400,
          cancel_at_period_end: false,
          canceled_at: null,
        },
      },
    };
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.subs).toHaveLength(1);
    expect(state.subs[0]).toMatchObject({
      userId: 'user-1',
      stripeSubscriptionId: 'sub_test_1',
      stripeCustomerId: 'cus_test_1',
      status: 'active',
    });
    expect(state.users[0]?.stripeCustomerId).toBe('cus_test_1');
  });

  it('customer.subscription.updated with missing current_period_*: skips upsert (does NOT write epoch-now and mark sub instantly expired)', async () => {
    const state = buildState();
    const event = {
      id: 'evt_sub_bad',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_1',
          customer: 'cus_test_1',
          status: 'active',
          metadata: { userId: 'user-1' },
          items: { data: [{ price: { id: 'price_weekly_test' } }] },
          // current_period_start / current_period_end omitted
          cancel_at_period_end: false,
          canceled_at: null,
        },
      },
    };
    const { service } = await buildService(state, () => event);
    await expect(service.handleEvent(Buffer.from('{}'), 'sig')).resolves.toMatchObject({
      received: true,
    });
    expect(state.subs).toHaveLength(0);
  });

  it('customer.subscription.deleted: marks status canceled', async () => {
    const state = buildState();
    state.subs.push({
      userId: 'user-1',
      stripeSubscriptionId: 'sub_test_1',
      stripeCustomerId: 'cus_test_1',
      stripePriceId: 'price_weekly_test',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 7 * 86400 * 1000),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    const event = {
      id: 'evt_sub_del',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_1',
          customer: 'cus_test_1',
          status: 'canceled',
          metadata: { userId: 'user-1' },
          items: { data: [{ price: { id: 'price_weekly_test' } }] },
        },
      },
    };
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.subs[0]?.status).toBe('canceled');
  });

  it('invoice.payment_failed: marks status past_due', async () => {
    const state = buildState();
    state.subs.push({
      userId: 'user-1',
      stripeSubscriptionId: 'sub_test_1',
      stripeCustomerId: 'cus_test_1',
      stripePriceId: 'price_weekly_test',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 7 * 86400 * 1000),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    const event = {
      id: 'evt_inv_fail',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_test_1' } },
    };
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.subs[0]?.status).toBe('past_due');
  });

  it('charge.refunded: reverses coins for a coin order, marks Order refunded', async () => {
    const state = buildState();
    state.users[0]!.coinBalance = 120;
    state.orders.push({
      id: 'order-1',
      userId: 'user-1',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntent: 'pi_test_1',
      type: 'COIN_PURCHASE',
      amount: 999,
      currency: 'usd',
      coinsGranted: 120,
      status: 'completed',
      completedAt: new Date(),
      metadata: {},
    });
    const event = {
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_test_1' } },
    };
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.users[0]?.coinBalance).toBe(0);
    expect(state.orders[0]?.status).toBe('refunded');
  });

  it('charge.refunded: duplicate refund event short-circuits at the event-id gate', async () => {
    const state = buildState();
    state.users[0]!.coinBalance = 120;
    state.orders.push({
      id: 'order-1',
      userId: 'user-1',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntent: 'pi_test_1',
      type: 'COIN_PURCHASE',
      amount: 999,
      currency: 'usd',
      coinsGranted: 120,
      status: 'completed',
      completedAt: new Date(),
      metadata: {},
    });
    const event = {
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_test_1' } },
    };
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    await service.handleEvent(Buffer.from('{}'), 'sig');
    // Balance stays at 0 (only debited once)
    expect(state.users[0]?.coinBalance).toBe(0);
  });

  it('charge.refunded for unknown payment_intent: no-op (no error)', async () => {
    const state = buildState();
    const event = {
      id: 'evt_refund_x',
      type: 'charge.refunded',
      data: { object: { id: 'ch_x', payment_intent: 'pi_unknown' } },
    };
    const { service } = await buildService(state, () => event);
    await expect(service.handleEvent(Buffer.from('{}'), 'sig')).resolves.toMatchObject({
      received: true,
    });
  });

  it('rejects with 500 (NOT 400) when STRIPE_WEBHOOK_SECRET is unset — server-side misconfig must trigger Stripe retry', async () => {
    const state = buildState();
    const { service } = await buildService(state, () => ({}));
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(service.handleEvent(Buffer.from('{}'), 'sig')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
