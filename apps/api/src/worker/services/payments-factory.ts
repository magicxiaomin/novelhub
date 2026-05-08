/**
 * Builds PaymentsService + WebhookService instances for the Cloudflare
 * Worker runtime. Mirrors the `useFactory` providers in payments.module.ts.
 *
 * One important wiring difference vs the Nest stack:
 *
 *   - `cryptoProvider`: Stripe's `constructEventAsync` defaults to a
 *     Node `crypto` provider. Workers must pass a SubtleCrypto provider
 *     so HMAC verification runs on Web Crypto.
 *
 * Task 10 wires the real `FbPurchaseEventPublisher` (factory-shape) for
 * `purchasePublisher`, replacing the Task 9 noop. Coin grants and
 * subscription checkouts now emit FB CAPI events identically to Nest.
 */
import type { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

import { CoinsService } from '../../modules/coins/coins.service';
import { PaymentsService } from '../../modules/payments/payments.service';
import { LazyStripe } from '../../modules/payments/stripe.client';
import { WebhookService } from '../../modules/payments/webhook.service';

import type { WorkerEnv as BaseWorkerEnv } from './auth-factory';
import { makeFbPurchaseEventPublisher, type FbCapiWorkerEnv } from './fb-capi-factory';

export type PaymentsWorkerEnv = BaseWorkerEnv &
  FbCapiWorkerEnv & {
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_PRICE_WEEKLY?: string;
    STRIPE_PRICE_MONTHLY?: string;
  };

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
    purchasePublisher: makeFbPurchaseEventPublisher(env, prisma),
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  });
}
