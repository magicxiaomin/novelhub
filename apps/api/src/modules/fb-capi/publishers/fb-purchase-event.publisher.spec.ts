import { Test, type TestingModule } from '@nestjs/testing';

import { PRISMA } from '../../auth/auth.constants';
import { FbCapiService } from '../fb-capi.service';

import { FbPurchaseEventPublisher } from './fb-purchase-event.publisher';

const makePrismaStub = () => ({
  user: {
    findUnique: jest.fn(async () => ({ email: 'buyer@example.com' })),
  },
});

describe('FbPurchaseEventPublisher', () => {
  let publisher: FbPurchaseEventPublisher;
  let prisma: ReturnType<typeof makePrismaStub>;
  let fbCapi: { sendEvent: jest.Mock<Promise<void>, Parameters<FbCapiService['sendEvent']>> };

  beforeEach(async () => {
    prisma = makePrismaStub();
    fbCapi = {
      sendEvent: jest.fn<
        ReturnType<FbCapiService['sendEvent']>,
        Parameters<FbCapiService['sendEvent']>
      >(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FbPurchaseEventPublisher,
        { provide: PRISMA, useValue: prisma },
        { provide: FbCapiService, useValue: fbCapi },
      ],
    }).compile();

    publisher = module.get(FbPurchaseEventPublisher);
  });

  it('publishes COIN_PURCHASE as Purchase with decimal value', async () => {
    await publisher.publish({
      userId: 'user-1',
      orderId: 'order-1',
      orderType: 'COIN_PURCHASE',
      amountMinor: 999,
      currency: 'usd',
      coinsGranted: 120,
      stripeSessionId: 'cs_123',
    });

    expect(fbCapi.sendEvent).toHaveBeenCalledWith(
      'Purchase',
      'cs_123',
      { email: 'buyer@example.com' },
      {
        currency: 'USD',
        value: 9.99,
        contentIds: ['coin_purchase'],
        contentType: 'product',
      },
      'user-1',
    );
  });

  it('publishes SUBSCRIPTION as Subscribe', async () => {
    await publisher.publish({
      userId: 'user-1',
      orderId: 'order-1',
      orderType: 'SUBSCRIPTION',
      amountMinor: 1299,
      currency: 'usd',
      coinsGranted: null,
      stripeSessionId: 'cs_456',
    });

    expect(fbCapi.sendEvent).toHaveBeenCalledWith(
      'Subscribe',
      'cs_456',
      { email: 'buyer@example.com' },
      {
        currency: 'USD',
        value: 12.99,
        contentIds: ['subscription'],
        contentType: 'product',
      },
      'user-1',
    );
  });
});
