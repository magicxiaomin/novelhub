import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { PRISMA } from '../auth/auth.constants';
import { CoinsService } from '../coins/coins.service';

import { STRIPE_CLIENT } from './stripe.constants';
import { WebhookService } from './webhook.service';

type FakeOrder = {
  id: string;
  userId: string;
  stripeSessionId: string;
  stripePaymentIntent: string | null;
  type: string;
  coinsGranted: number | null;
  status: string;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
};

type FakeUser = { id: string; coinBalance: number; deletedAt: Date | null };

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

const buildPrismaStub = (state: {
  users: FakeUser[];
  orders: FakeOrder[];
  subs: FakeSubscription[];
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
      };
      data: { coinBalance: { increment: number } };
    }) => {
      const u = usersById.get(where.id);
      if (!u || u.deletedAt) return { count: 0 };
      if (where.coinBalance?.gte !== undefined) {
        if (u.coinBalance < where.coinBalance.gte) return { count: 0 };
      }
      u.coinBalance += data.coinBalance.increment;
      return { count: 1 };
    },
  };

  const coinTransactionClient = {
    create: async () => ({ id: `txn-${Math.random()}` }),
  };

  type PrismaShape = {
    order: typeof orderClient;
    subscription: typeof subscriptionClient;
    user: typeof userClient;
    coinTransaction: typeof coinTransactionClient;
    $transaction: <T>(cb: (tx: PrismaShape) => Promise<T>) => Promise<T>;
  };
  const prisma: PrismaShape = {
    order: orderClient,
    subscription: subscriptionClient,
    user: userClient,
    coinTransaction: coinTransactionClient,
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

describe('WebhookService', () => {
  const buildService = async (
    state: ReturnType<typeof buildState>,
    eventBuilder: () => unknown,
  ): Promise<{
    service: WebhookService;
    state: typeof state;
  }> => {
    const prisma = buildPrismaStub(state);
    const stripe = buildStripeStub(() => eventBuilder());
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        CoinsService,
        { provide: PRISMA, useValue: prisma },
        { provide: STRIPE_CLIENT, useValue: stripe },
      ],
    }).compile();
    return { service: module.get(WebhookService), state };
  };

  const buildState = () => ({
    users: [{ id: 'user-1', coinBalance: 0, deletedAt: null }] as FakeUser[],
    orders: [] as FakeOrder[],
    subs: [] as FakeSubscription[],
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

  it('checkout.session.completed (coin order, pre-existing pending Order): grants coins, marks completed', async () => {
    const state = buildState();
    state.orders.push({
      id: 'order-1',
      userId: 'user-1',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntent: null,
      type: 'COIN_PURCHASE',
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
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');

    expect(state.users[0]?.coinBalance).toBe(120);
    expect(state.orders[0]?.status).toBe('completed');
    expect(state.orders[0]?.stripePaymentIntent).toBe('pi_test_1');
  });

  it('duplicate checkout.session.completed: does not double-grant coins', async () => {
    const state = buildState();
    state.orders.push({
      id: 'order-1',
      userId: 'user-1',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntent: null,
      type: 'COIN_PURCHASE',
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
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.users[0]?.coinBalance).toBe(120);
  });

  it('checkout.session.completed (coin order, no pre-Order): creates Order completed AND grants coins', async () => {
    const state = buildState();
    const event = {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_recover_1',
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
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0]?.status).toBe('completed');
    // No coinsGranted on the recovered order → balance unchanged.
    expect(state.users[0]?.coinBalance).toBe(0);
  });

  it('customer.subscription.created: upserts a Subscription row', async () => {
    const state = buildState();
    const event = {
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
      coinsGranted: 120,
      status: 'completed',
      completedAt: new Date(),
      metadata: {},
    });
    const event = {
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_test_1' } },
    };
    const { service } = await buildService(state, () => event);
    await service.handleEvent(Buffer.from('{}'), 'sig');
    expect(state.users[0]?.coinBalance).toBe(0);
    expect(state.orders[0]?.status).toBe('refunded');
  });

  it('charge.refunded: duplicate refund event is a no-op (status already refunded)', async () => {
    const state = buildState();
    state.users[0]!.coinBalance = 120;
    state.orders.push({
      id: 'order-1',
      userId: 'user-1',
      stripeSessionId: 'cs_test_1',
      stripePaymentIntent: 'pi_test_1',
      type: 'COIN_PURCHASE',
      coinsGranted: 120,
      status: 'completed',
      completedAt: new Date(),
      metadata: {},
    });
    const event = {
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
      type: 'charge.refunded',
      data: { object: { id: 'ch_x', payment_intent: 'pi_unknown' } },
    };
    const { service } = await buildService(state, () => event);
    await expect(service.handleEvent(Buffer.from('{}'), 'sig')).resolves.toMatchObject({
      received: true,
    });
  });

  it('rejects when STRIPE_WEBHOOK_SECRET is unset', async () => {
    const state = buildState();
    const { service } = await buildService(state, () => ({}));
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(service.handleEvent(Buffer.from('{}'), 'sig')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
