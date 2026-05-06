import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  COIN_PACKAGES,
  type CoinPackageId,
  ORDER_STATUS,
  ORDER_TYPE,
  SUBSCRIPTION_STATUS,
} from '@novelhub/shared';
import type Stripe from 'stripe';

import { PRISMA } from '../auth/auth.constants';
import { COIN_TXN_TYPE } from '../coins/coins.constants';
import { CoinsService } from '../coins/coins.service';

import { PURCHASE_EVENT_PUBLISHER, type PurchaseEventPublisher } from './purchase-event.publisher';
import { type StripeClient } from './stripe.client';
import { type CheckoutSessionMetadata, METADATA_KEY, STRIPE_CLIENT } from './stripe.constants';

/**
 * JUSTIFICATION: Stripe SDK v17's `Stripe.Subscription` type omits
 * `current_period_start`/`current_period_end` on the top-level subscription
 * object (they live on `items.data[*].current_period_*` in newer API versions
 * but are still present at the top level on the API version we pin). Casting
 * once here keeps the call sites readable and centralises the type gap so a
 * future SDK bump only touches this file.
 */
type SubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    private readonly coins: CoinsService,
    @Inject(PURCHASE_EVENT_PUBLISHER) private readonly purchasePublisher: PurchaseEventPublisher,
  ) {}

  /**
   * Verify the webhook signature, gate on event.id idempotency, and dispatch
   * by event type.
   *
   * Idempotency layers (defence in depth):
   * 1. `WebhookEvent.stripeEventId @unique` — the first thing we do is
   *    insert the event id. A duplicate delivery hits the unique constraint
   *    and short-circuits before any handler runs. This is the layer the
   *    ticket requires (task #7) and the one that protects
   *    `customer.subscription.updated`, where an out-of-order replay would
   *    otherwise clobber newer state via unconditional `upsert`.
   * 2. Coin grants additionally use a `WHERE status='pending'` predicate on
   *    `updateMany`, so even a non-deduped retry can't double-grant.
   * 3. Subscription writes are upserts keyed on `stripeSubscriptionId`.
   * 4. Refund logic gates on `status='completed'` before reversing.
   */
  async handleEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: true; type: string; duplicate?: true }> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      // Server-side misconfig is 5xx so Stripe retries; 4xx would mark the
      // event delivered and silently swallow it.
      throw new InternalServerErrorException('Webhook secret not configured');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.get().webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      throw new BadRequestException(`Invalid Stripe signature: ${(err as Error).message}`);
    }

    this.logger.log(`Stripe event ${event.type} (${event.id})`);

    // event.id idempotency gate — INSERT first, run handlers only if we won
    // the race. A duplicate event hits the unique constraint and is dropped
    // with a 200 OK so Stripe stops retrying.
    try {
      await this.prisma.webhookEvent.create({
        data: { stripeEventId: event.id, eventType: event.type },
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        this.logger.log(`Skipping duplicate Stripe event ${event.id}`);
        return { received: true, type: event.type, duplicate: true };
      }
      throw err;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        // Renewal / first invoice — subscription.updated handles the state.
        // Nothing to do server-side beyond logging for now; Ticket 11 CAPI
        // hooks into the coin-purchase path via PurchaseEventPublisher.
        this.logger.log(
          `invoice.payment_succeeded for ${(event.data.object as Stripe.Invoice).id}`,
        );
        break;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'charge.refunded':
        await this.onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true, type: event.type };
  }

  private isUniqueViolation(err: unknown): boolean {
    // Prisma surfaces unique-constraint violations as P2002. We accept either
    // the structured error or a duck-typed shape (test stubs throw plain
    // objects with the same `code`).
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = (session.metadata ?? {}) as Partial<CheckoutSessionMetadata>;
    const userId = metadata[METADATA_KEY.USER_ID];
    const orderType = metadata[METADATA_KEY.ORDER_TYPE];
    if (!userId || !orderType) {
      this.logger.warn(
        `checkout.session.completed missing metadata for session ${session.id}; skipping`,
      );
      return;
    }

    // Capture the Stripe Customer id so subsequent checkouts reuse the same
    // customer record (avoids minting duplicates via customer_email and keeps
    // the Customer Portal lookup stable).
    await this.captureStripeCustomer(userId, session.customer);

    if (orderType === ORDER_TYPE.COIN_PURCHASE) {
      await this.completeCoinOrder(session, userId, metadata);
    } else if (orderType === ORDER_TYPE.SUBSCRIPTION) {
      // Subscription state is owned by customer.subscription.* events.
      // Mark the Order as completed for audit; nothing else to do here.
      await this.markOrderCompleted(session);
    }
  }

  private async captureStripeCustomer(
    userId: string,
    customer: Stripe.Checkout.Session['customer'],
  ): Promise<void> {
    const customerId = typeof customer === 'string' ? customer : customer?.id;
    if (!customerId) return;
    // Only set it if currently null — never overwrite a value we previously
    // captured. updateMany with a null predicate makes this a single
    // round-trip without read-then-write races.
    await this.prisma.user.updateMany({
      where: { id: userId, stripeCustomerId: null },
      data: { stripeCustomerId: customerId },
    });
  }

  private async completeCoinOrder(
    session: Stripe.Checkout.Session,
    userId: string,
    metadata: Partial<CheckoutSessionMetadata>,
  ): Promise<void> {
    const packageId = metadata[METADATA_KEY.PACKAGE_ID];
    if (!packageId) {
      this.logger.warn(`Coin checkout session ${session.id} missing packageId metadata`);
      return;
    }

    // Atomic completion + grant: order status flip and coin balance adjust
    // happen in the same transaction so a crash between them rolls both back.
    // Without this, a second webhook delivery would see status=COMPLETED and
    // skip the grant — user charged, no coins.
    //
    // Idempotency comes from the event.id gate (handleEvent) plus the
    // `WHERE status='pending'` predicate on updateMany — defence in depth.
    const paymentIntent =
      typeof session.payment_intent === 'string' ? session.payment_intent : null;

    const grant = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          stripeSessionId: session.id,
          status: ORDER_STATUS.PENDING,
        },
        data: {
          status: ORDER_STATUS.COMPLETED,
          completedAt: new Date(),
          stripePaymentIntent: paymentIntent,
        },
      });

      if (result.count === 0) {
        // Either already-completed (defence-in-depth duplicate) or no
        // pre-Order at all (the pre-create call failed before this webhook
        // landed).
        const existing = await tx.order.findUnique({
          where: { stripeSessionId: session.id },
          select: { id: true, status: true, coinsGranted: true },
        });
        if (existing) {
          this.logger.log(
            `Skipping coin grant for session ${session.id} — order already ${existing.status}`,
          );
          return null;
        }

        // Recovery path: derive coin count from packageId metadata since we
        // never wrote a pre-Order with coinsGranted.
        const pkg = COIN_PACKAGES[packageId as CoinPackageId];
        if (!pkg) {
          this.logger.warn(`Recovery for session ${session.id}: unknown packageId ${packageId}`);
          return null;
        }
        const recovered = await tx.order.create({
          data: {
            userId,
            stripeSessionId: session.id,
            type: ORDER_TYPE.COIN_PURCHASE,
            amount: session.amount_total ?? Math.round(pkg.priceUsd * 100),
            currency: (session.currency ?? 'usd').toLowerCase(),
            coinsGranted: pkg.coins,
            status: ORDER_STATUS.COMPLETED,
            completedAt: new Date(),
            metadata: { packageId, recovered: true },
            stripePaymentIntent: paymentIntent,
          },
          select: { id: true, coinsGranted: true, amount: true, currency: true },
        });
        await this.coins.adjustBalance(userId, pkg.coins, COIN_TXN_TYPE.PURCHASE, recovered.id, tx);
        return {
          orderId: recovered.id,
          coinsGranted: recovered.coinsGranted,
          amountMinor: recovered.amount,
          currency: recovered.currency,
        };
      }

      // Happy path: this thread won the PENDING → COMPLETED transition.
      const updated = await tx.order.findUnique({
        where: { stripeSessionId: session.id },
        select: { id: true, coinsGranted: true, amount: true, currency: true },
      });
      if (!updated || !updated.coinsGranted || updated.coinsGranted <= 0) {
        this.logger.warn(
          `Order for session ${session.id} has no coinsGranted — skipping balance adjust`,
        );
        return null;
      }
      await this.coins.adjustBalance(
        userId,
        updated.coinsGranted,
        COIN_TXN_TYPE.PURCHASE,
        updated.id,
        tx,
      );
      return {
        orderId: updated.id,
        coinsGranted: updated.coinsGranted,
        amountMinor: updated.amount,
        currency: updated.currency,
      };
    });

    // Publish AFTER commit — a downstream side-effect (e.g. CAPI) must not
    // be able to roll back the coin grant. Failures bubble up so Stripe
    // retries (event.id gate prevents the grant from re-running).
    if (grant) {
      await this.purchasePublisher.publish({
        userId,
        orderId: grant.orderId,
        orderType: ORDER_TYPE.COIN_PURCHASE,
        amountMinor: grant.amountMinor,
        currency: grant.currency,
        coinsGranted: grant.coinsGranted,
        stripeSessionId: session.id,
      });
    }
  }

  private async markOrderCompleted(session: Stripe.Checkout.Session): Promise<void> {
    await this.prisma.order.updateMany({
      where: {
        stripeSessionId: session.id,
        status: ORDER_STATUS.PENDING,
      },
      data: {
        status: ORDER_STATUS.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  private async onSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
    const userId = (sub.metadata ?? {})[METADATA_KEY.USER_ID];
    if (!userId) {
      this.logger.warn(
        `subscription event ${sub.id} missing userId metadata; cannot bind to a user`,
      );
      return;
    }
    const priceId = sub.items.data[0]?.price?.id ?? '';
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

    const periods = this.subscriptionPeriods(sub);
    if (!periods) {
      // Period bounds are required columns and have no sensible default —
      // writing `now()` would mark a real subscription expired the moment
      // the row lands. Skip and log so operators can investigate.
      this.logger.warn(
        `subscription event ${sub.id} missing current_period_start/end; skipping upsert`,
      );
      return;
    }

    // Cache the customer on the user too (covers users whose first action
    // is a subscription with no prior coin checkout).
    await this.captureStripeCustomer(userId, customerId);

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: {
        userId,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        status: sub.status,
        currentPeriodStart: periods.start,
        currentPeriodEnd: periods.end,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        canceledAt: this.optionalDate(sub.canceled_at),
      },
      update: {
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        status: sub.status,
        currentPeriodStart: periods.start,
        currentPeriodEnd: periods.end,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        canceledAt: this.optionalDate(sub.canceled_at),
      },
    });
  }

  private subscriptionPeriods(sub: Stripe.Subscription): { start: Date; end: Date } | null {
    const widened = sub as SubscriptionWithPeriods;
    if (!widened.current_period_start || !widened.current_period_end) return null;
    return {
      start: new Date(widened.current_period_start * 1000),
      end: new Date(widened.current_period_end * 1000),
    };
  }

  private optionalDate(secondsSinceEpoch: number | null | undefined): Date | null {
    if (!secondsSinceEpoch) return null;
    return new Date(secondsSinceEpoch * 1000);
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status: SUBSCRIPTION_STATUS.CANCELED,
        canceledAt: new Date(),
        cancelAtPeriodEnd: false,
      },
    });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subId = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription;
    if (!subId || typeof subId !== 'string') return;
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { status: SUBSCRIPTION_STATUS.PAST_DUE },
    });
  }

  private async onChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const paymentIntent =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!paymentIntent) {
      this.logger.warn(
        `charge.refunded for ${charge.id} has no payment_intent; cannot map to order`,
      );
      return;
    }
    const order = await this.prisma.order.findUnique({
      where: { stripePaymentIntent: paymentIntent },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        coinsGranted: true,
      },
    });
    if (!order) {
      this.logger.warn(`No order matching payment_intent ${paymentIntent}; skipping refund`);
      return;
    }
    if (order.status !== ORDER_STATUS.COMPLETED) {
      this.logger.log(`Order ${order.id} is ${order.status}, not COMPLETED — skipping refund`);
      return;
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const transitioned = await tx.order.updateMany({
        where: { id: order.id, status: ORDER_STATUS.COMPLETED },
        data: { status: ORDER_STATUS.REFUNDED },
      });
      if (transitioned.count === 0) {
        // Lost the race with a duplicate refund event; nothing to do.
        return;
      }
      if (order.type === ORDER_TYPE.COIN_PURCHASE && order.coinsGranted && order.coinsGranted > 0) {
        await this.coins.adjustBalance(
          order.userId,
          -order.coinsGranted,
          COIN_TXN_TYPE.REFUND,
          order.id,
          tx,
        );
      }
    });
  }
}
