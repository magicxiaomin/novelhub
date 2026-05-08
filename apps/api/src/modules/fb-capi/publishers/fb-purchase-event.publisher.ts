import type { PrismaClient } from '@prisma/client';

import {
  type PurchaseCompletedEvent,
  type PurchaseEventPublisher,
} from '../../payments/purchase-event.publisher';
import type { FbCustomData, FbUserData } from '../fb-capi.types';

type OrderFbMetadata = {
  fbConsent?: boolean;
  fbUserData?: Omit<FbUserData, 'email'> | null;
  fbUserDataScrubbedAt?: string;
};

// Structural shape of the FbCapiService surface we depend on. Letting the
// publisher take a plain interface (not the concrete class) keeps it
// runtime-agnostic — both Nest DI and the Worker factory can satisfy it.
export type FbPurchaseCapiClient = {
  sendEvent(
    eventName: string,
    eventId: string,
    userData: FbUserData,
    customData?: FbCustomData,
    userId?: string,
  ): Promise<void>;
};

export type FbPurchaseEventPublisherDeps = {
  prisma: PrismaClient;
  fbCapi: FbPurchaseCapiClient;
};

export class FbPurchaseEventPublisher implements PurchaseEventPublisher {
  private readonly prisma: PrismaClient;
  private readonly fbCapi: FbPurchaseCapiClient;

  constructor(deps: FbPurchaseEventPublisherDeps) {
    this.prisma = deps.prisma;
    this.fbCapi = deps.fbCapi;
  }

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
        // eslint-disable-next-line no-console
        console.warn(`[FbPurchaseEventPublisher] missing user ${event.userId}`);
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

      await this.prisma.order.update({
        where: { id: event.orderId },
        data: {
          metadata: {
            ...((meta as object | null) ?? {}),
            fbUserData: null,
            fbUserDataScrubbedAt: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[FbPurchaseEventPublisher] publish failed', err);
    }
  }
}
