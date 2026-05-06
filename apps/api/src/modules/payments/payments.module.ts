import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NoopPurchaseEventPublisher, PURCHASE_EVENT_PUBLISHER } from './purchase-event.publisher';
import { StripeClientProvider } from './stripe.client';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule, CoinsModule],
  controllers: [PaymentsController, WebhookController],
  providers: [
    PaymentsService,
    WebhookService,
    StripeClientProvider,
    // Default no-op publisher; Ticket 11 (FB CAPI) overrides this provider
    // to ship a real Conversions API Purchase event.
    { provide: PURCHASE_EVENT_PUBLISHER, useClass: NoopPurchaseEventPublisher },
  ],
  exports: [PaymentsService, WebhookService, PURCHASE_EVENT_PUBLISHER],
})
export class PaymentsModule {}
