/**
 * Extension point for downstream modules (e.g. Ticket 11 FB CAPI) to react
 * to a completed purchase without coupling the payments module to them.
 *
 * The default provider in PaymentsModule is a no-op logger; the CAPI module
 * will replace it with a forwarder that fires a Conversions API Purchase
 * event. Keeping this contract narrow on purpose: only the data Stripe
 * already gave us, no DB lookups, so the publisher cannot stall the webhook
 * response (Stripe retries on 5xx).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';

export type PurchaseCompletedEvent = {
  userId: string;
  orderId: string;
  /** 'COIN_PURCHASE' or 'SUBSCRIPTION'. */
  orderType: string;
  /** Total in minor units (cents) — matches Stripe's amount_total. */
  amountMinor: number;
  /** ISO 4217 currency, lowercased ('usd'). */
  currency: string;
  /** Coin count granted, when applicable. */
  coinsGranted: number | null;
  /** Stripe Checkout Session id, used as event_id for de-duplication on the CAPI side. */
  stripeSessionId: string;
};

export interface PurchaseEventPublisher {
  publish(event: PurchaseCompletedEvent): Promise<void>;
}

export const PURCHASE_EVENT_PUBLISHER = Symbol('PURCHASE_EVENT_PUBLISHER');

/**
 * Default implementation: log only. Ticket 11 (FB CAPI) replaces this
 * provider so a real Purchase event ships to Meta.
 */
@Injectable()
export class NoopPurchaseEventPublisher implements PurchaseEventPublisher {
  private readonly logger = new Logger(NoopPurchaseEventPublisher.name);

  async publish(event: PurchaseCompletedEvent): Promise<void> {
    this.logger.log(
      `purchase.completed (no-op publisher): user=${event.userId} session=${event.stripeSessionId} type=${event.orderType} amount=${event.amountMinor}${event.currency}`,
    );
  }
}

/**
 * Convenience injector decorator for consumers.
 */
export const InjectPurchasePublisher = (): ParameterDecorator => Inject(PURCHASE_EVENT_PUBLISHER);
