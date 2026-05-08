import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../auth/auth.constants';
import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';
import { CoinsService } from '../coins/coins.service';
import { FbCapiModule } from '../fb-capi/fb-capi.module';
import { FbPurchaseEventPublisher } from '../fb-capi/publishers/fb-purchase-event.publisher';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PURCHASE_EVENT_PUBLISHER, type PurchaseEventPublisher } from './purchase-event.publisher';
import { LazyStripe, type StripeClient } from './stripe.client';
import { STRIPE_CLIENT } from './stripe.constants';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule, CoinsModule, FbCapiModule],
  controllers: [PaymentsController, WebhookController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      useFactory: (): LazyStripe => new LazyStripe(process.env.STRIPE_SECRET_KEY),
    },
    { provide: PURCHASE_EVENT_PUBLISHER, useExisting: FbPurchaseEventPublisher },
    {
      provide: PaymentsService,
      useFactory: (prisma: PrismaClient, stripe: StripeClient): PaymentsService =>
        new PaymentsService({
          prisma,
          stripe,
          appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
          subscriptionPriceIds: {
            weekly: process.env.STRIPE_PRICE_WEEKLY,
            monthly: process.env.STRIPE_PRICE_MONTHLY,
          },
        }),
      inject: [PRISMA, STRIPE_CLIENT],
    },
    {
      provide: WebhookService,
      useFactory: (
        prisma: PrismaClient,
        stripe: StripeClient,
        coins: CoinsService,
        purchasePublisher: PurchaseEventPublisher,
      ): WebhookService =>
        new WebhookService({
          prisma,
          stripe,
          coins,
          purchasePublisher,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        }),
      inject: [PRISMA, STRIPE_CLIENT, CoinsService, PURCHASE_EVENT_PUBLISHER],
    },
  ],
  exports: [PaymentsService, WebhookService, PURCHASE_EVENT_PUBLISHER],
})
export class PaymentsModule {}
