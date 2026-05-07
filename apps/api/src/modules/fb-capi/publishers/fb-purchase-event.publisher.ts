import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PRISMA } from '../../auth/auth.constants';
import {
  type PurchaseCompletedEvent,
  type PurchaseEventPublisher,
} from '../../payments/purchase-event.publisher';
import { FbCapiService } from '../fb-capi.service';
import type { FbUserData } from '../fb-capi.types';

type OrderFbMetadata = {
  fbConsent?: boolean;
  fbUserData?: Omit<FbUserData, 'email'> | null;
};

@Injectable()
export class FbPurchaseEventPublisher implements PurchaseEventPublisher {
  private readonly logger = new Logger(FbPurchaseEventPublisher.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly fbCapi: FbCapiService,
  ) {}

  async publish(event: PurchaseCompletedEvent): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: { metadata: true },
      });
      const meta = order?.metadata as OrderFbMetadata | null;
      if (!meta?.fbConsent) return;

      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true },
      });
      if (!user) {
        this.logger.warn(`Skipping FB CAPI event for missing user ${event.userId}`);
        return;
      }

      await this.fbCapi.sendEvent(
        event.orderType === 'SUBSCRIPTION' ? 'Subscribe' : 'Purchase',
        event.stripeSessionId,
        { ...(meta.fbUserData ?? {}), email: user.email },
        {
          currency: event.currency.toUpperCase(),
          value: event.amountMinor / 100,
          contentIds: [event.orderType.toLowerCase()],
          contentType: 'product',
        },
        event.userId,
      );
    } catch (err) {
      this.logger.error('FB purchase publisher failed', err as Error);
    }
  }
}
