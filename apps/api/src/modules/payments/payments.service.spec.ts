import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { PRISMA } from '../auth/auth.constants';

import { PaymentsService } from './payments.service';
import { STRIPE_CLIENT } from './stripe.constants';

const buildPrismaStub = () => {
  const users = new Map<string, { id: string; email: string; deletedAt: Date | null }>();
  const subscriptions: Array<{
    userId: string;
    stripeCustomerId: string;
    updatedAt: Date;
  }> = [];
  const orders: Array<{
    id: string;
    userId: string;
    stripeSessionId: string;
    type: string;
    coinsGranted: number | null;
    status: string;
    completedAt: Date | null;
    metadata: Record<string, unknown>;
  }> = [];
  let orderCounter = 0;
  return {
    prisma: {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
      },
      subscription: {
        findFirst: async ({ where }: { where: { userId: string } }) =>
          subscriptions
            .filter((s) => s.userId === where.userId)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null,
      },
      order: {
        create: async ({
          data,
        }: {
          data: {
            userId: string;
            stripeSessionId: string;
            type: string;
            amount: number;
            coinsGranted: number | null;
            status: string;
            metadata: Record<string, unknown>;
          };
        }) => {
          orderCounter += 1;
          const o = {
            id: `order-${orderCounter}`,
            ...data,
            completedAt: null,
          };
          orders.push(o);
          return o;
        },
        findUnique: async ({ where }: { where: { stripeSessionId: string } }) =>
          orders.find((o) => o.stripeSessionId === where.stripeSessionId) ?? null,
      },
    },
    users,
    subscriptions,
    orders,
  };
};

const buildStripeStub = () => {
  const checkoutCreate = jest.fn(async (params: { metadata?: Record<string, string> }) => ({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.test/cs_test_123',
    metadata: params.metadata ?? {},
  }));
  const portalCreate = jest.fn(async () => ({
    url: 'https://portal.stripe.test/p_123',
  }));
  return {
    get: () => ({
      checkout: { sessions: { create: checkoutCreate } },
      billingPortal: { sessions: { create: portalCreate } },
    }),
    spies: { checkoutCreate, portalCreate },
  };
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof buildPrismaStub>;
  let stripe: ReturnType<typeof buildStripeStub>;

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.STRIPE_PRICE_WEEKLY = 'price_weekly_test';
    process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_test';

    prisma = buildPrismaStub();
    stripe = buildStripeStub();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PRISMA, useValue: prisma.prisma },
        { provide: STRIPE_CLIENT, useValue: stripe },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  it('createCoinCheckout: returns Stripe URL with correct metadata and writes pending Order', async () => {
    prisma.users.set('user-1', {
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
    });
    const result = await service.createCoinCheckout('user-1', 'pack_120');
    expect(result.url).toMatch(/checkout\.stripe\.test/);
    expect(result.sessionId).toBe('cs_test_123');

    const sessionArg = stripe.spies.checkoutCreate.mock.calls[0]?.[0] as {
      metadata: Record<string, string>;
      customer_email: string;
      mode: string;
      line_items: Array<{ price_data: { unit_amount: number } }>;
    };
    expect(sessionArg.mode).toBe('payment');
    expect(sessionArg.customer_email).toBe('luna@example.com');
    expect(sessionArg.metadata.userId).toBe('user-1');
    expect(sessionArg.metadata.orderType).toBe('COIN_PURCHASE');
    expect(sessionArg.metadata.packageId).toBe('pack_120');
    expect(sessionArg.line_items[0]?.price_data.unit_amount).toBe(999);

    expect(prisma.orders).toHaveLength(1);
    expect(prisma.orders[0]).toMatchObject({
      userId: 'user-1',
      stripeSessionId: 'cs_test_123',
      coinsGranted: 120,
      status: 'pending',
    });
  });

  it('createCoinCheckout: 401 for unknown user', async () => {
    await expect(service.createCoinCheckout('ghost', 'pack_50')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('createCoinCheckout: 401 for soft-deleted user', async () => {
    prisma.users.set('user-1', {
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: new Date(),
    });
    await expect(service.createCoinCheckout('user-1', 'pack_50')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('createSubscriptionCheckout: passes the env-pinned price ID', async () => {
    prisma.users.set('user-1', {
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
    });
    await service.createSubscriptionCheckout('user-1', 'monthly');
    const sessionArg = stripe.spies.checkoutCreate.mock.calls[0]?.[0] as {
      mode: string;
      line_items: Array<{ price: string }>;
    };
    expect(sessionArg.mode).toBe('subscription');
    expect(sessionArg.line_items[0]?.price).toBe('price_monthly_test');
  });

  it('createSubscriptionCheckout: throws when env price id is missing', async () => {
    prisma.users.set('user-1', {
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
    });
    delete process.env.STRIPE_PRICE_WEEKLY;
    await expect(service.createSubscriptionCheckout('user-1', 'weekly')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('createPortalSession: 404 when user has no subscription', async () => {
    prisma.users.set('user-1', {
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
    });
    await expect(service.createPortalSession('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createPortalSession: returns URL for users with a Stripe customer', async () => {
    prisma.users.set('user-1', {
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
    });
    prisma.subscriptions.push({
      userId: 'user-1',
      stripeCustomerId: 'cus_test_123',
      updatedAt: new Date(),
    });
    const result = await service.createPortalSession('user-1');
    expect(result.url).toMatch(/portal\.stripe\.test/);
  });

  it('getOrderStatus: 404 when order belongs to another user', async () => {
    prisma.users.set('user-1', {
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
    });
    prisma.orders.push({
      id: 'order-x',
      userId: 'someone-else',
      stripeSessionId: 'cs_alien',
      type: 'COIN_PURCHASE',
      coinsGranted: 50,
      status: 'completed',
      completedAt: new Date(),
      metadata: {},
    });
    await expect(service.getOrderStatus('user-1', 'cs_alien')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
