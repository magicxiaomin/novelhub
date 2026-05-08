/**
 * Builds PaymentsService + WebhookService instances for the Cloudflare
 * Worker runtime. Mirrors the `useFactory` providers in payments.module.ts.
 *
 * Two important wiring differences vs the Nest stack:
 *
 *   1. `PURCHASE_EVENT_PUBLISHER`: the Nest stack wires the FB CAPI
 *      publisher (apps/api/src/modules/fb-capi/...). That module is not
 *      yet ported to Workers (Task 10 — CAPI async-hash). Until then we
 *      use a no-op log-only publisher so coin grants and subscription
 *      checkouts complete without breaking on a missing publisher.
 *
 *   2. `cryptoProvider`: Stripe's `constructEventAsync` defaults to a
 *      Node `crypto` provider. Workers must pass a SubtleCrypto provider
 *      so HMAC verification runs on Web Crypto.
 */
import type { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

import { CoinsService } from '../../modules/coins/coins.service';
import { PaymentsService } from '../../modules/payments/payments.service';
import {
  type PurchaseCompletedEvent,
  type PurchaseEventPublisher,
} from '../../modules/payments/purchase-event.publisher';
import { LazyStripe } from '../../modules/payments/stripe.client';
import { WebhookService } from '../../modules/payments/webhook.service';

import type { WorkerEnv as BaseWorkerEnv } from './auth-factory';

export type PaymentsWorkerEnv = BaseWorkerEnv & {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_WEEKLY?: string;
  STRIPE_PRICE_MONTHLY?: string;
};

class NoopPurchasePublisher implements PurchaseEventPublisher {
  async publish(event: PurchaseCompletedEvent): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `[NoopPurchasePublisher] purchase.completed user=${event.userId} session=${event.stripeSessionId} type=${event.orderType} amount=${event.amountMinor}${event.currency}`,
    );
  }
}

const APP_URL_FALLBACK = 'http://localhost:3000';

export function makePaymentsService(env: PaymentsWorkerEnv, prisma: PrismaClient): PaymentsService {
  return new PaymentsService({
    prisma,
    stripe: new LazyStripe(env.STRIPE_SECRET_KEY),
    appUrl: env.NEXT_PUBLIC_APP_URL ?? APP_URL_FALLBACK,
    subscriptionPriceIds: {
      weekly: env.STRIPE_PRICE_WEEKLY,
      monthly: env.STRIPE_PRICE_MONTHLY,
    },
  });
}

export function makeWebhookService(env: PaymentsWorkerEnv, prisma: PrismaClient): WebhookService {
  return new WebhookService({
    prisma,
    stripe: new LazyStripe(env.STRIPE_SECRET_KEY),
    coins: new CoinsService({ prisma }),
    purchasePublisher: new NoopPurchasePublisher(),
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  });
}
