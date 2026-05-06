import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CoinsModule } from '../coins/coins.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeClientProvider } from './stripe.client';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule, CoinsModule],
  controllers: [PaymentsController, WebhookController],
  providers: [PaymentsService, WebhookService, StripeClientProvider],
  exports: [PaymentsService, WebhookService],
})
export class PaymentsModule {}
