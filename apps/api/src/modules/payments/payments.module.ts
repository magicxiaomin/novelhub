import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';
import { FbCapiModule } from '../fb-capi/fb-capi.module';
import { FbPurchaseEventPublisher } from '../fb-capi/publishers/fb-purchase-event.publisher';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PURCHASE_EVENT_PUBLISHER } from './purchase-event.publisher';
import { StripeClientProvider } from './stripe.client';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule, CoinsModule, FbCapiModule],
  controllers: [PaymentsController, WebhookController],
  providers: [
    PaymentsService,
    WebhookService,
    StripeClientProvider,
    { provide: PURCHASE_EVENT_PUBLISHER, useClass: FbPurchaseEventPublisher },
  ],
  exports: [PaymentsService, WebhookService, PURCHASE_EVENT_PUBLISHER],
})
export class PaymentsModule {}
