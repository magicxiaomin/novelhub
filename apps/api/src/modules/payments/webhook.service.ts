import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
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

import { type StripeClient } from './stripe.client';
import { type CheckoutSessionMetadata, METADATA_KEY, STRIPE_CLIENT } from './stripe.constants';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    private readonly coins: CoinsService,
  ) {}

  /**
   * Verify the webhook signature and dispatch by event type.
   *
   * Idempotency notes:
   * - Coin grants are gated by `Order.status === 'pending'`. A duplicate
   *   `checkout.session.completed` lands on a `'completed'` row and short-circuits.
   * - Subscription writes are upserts keyed on `stripeSubscriptionId @unique`.
   * - Refund logic checks `Order.status === 'completed'` before reversing.
   */
  async handleEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: true; type: string }> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('Webhook secret not configured (STRIPE_WEBHOOK_SECRET unset)');
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
        // Nothing to do server-side beyond logging for now.
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

    if (orderType === ORDER_TYPE.COIN_PURCHASE) {
      await this.completeCoinOrder(session, userId, metadata);
    } else if (orderType === ORDER_TYPE.SUBSCRIPTION) {
      // Subscription state is owned by customer.subscription.* events.
      // Mark the Order as completed for audit; nothing else to do here.
      await this.markOrderCompleted(session);
    }
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
    // Idempotency comes from the `WHERE status='pending'` predicate on
    // updateMany — a duplicate webhook sees count=0, hits the existing-Order
    // branch, sees status already COMPLETED, and exits without touching the
    // balance.
    const paymentIntent =
      typeof session.payment_intent === 'string' ? session.payment_intent : null;

    await this.prisma.$transaction(async (tx) => {
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
        // Either already-completed (duplicate webhook) or no pre-Order at all
        // (the pre-create call failed before this webhook landed).
        const existing = await tx.order.findUnique({
          where: { stripeSessionId: session.id },
          select: { id: true, status: true, coinsGranted: true },
        });
        if (existing) {
          // Duplicate webhook on an already-completed (or refunded) order.
          this.logger.log(
            `Skipping coin grant for session ${session.id} — order already ${existing.status}`,
          );
          return;
        }

        // Recovery path: derive coin count from packageId metadata since we
        // never wrote a pre-Order with coinsGranted.
        const pkg = COIN_PACKAGES[packageId as CoinPackageId];
        if (!pkg) {
          this.logger.warn(`Recovery for session ${session.id}: unknown packageId ${packageId}`);
          return;
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
          select: { id: true },
        });
        await this.coins.adjustBalance(userId, pkg.coins, COIN_TXN_TYPE.PURCHASE, recovered.id, tx);
        return;
      }

      // Happy path: this thread won the PENDING → COMPLETED transition.
      // Look up the order to read coinsGranted (set when the order was pre-created)
      // and grant atomically inside the same transaction.
      const updated = await tx.order.findUnique({
        where: { stripeSessionId: session.id },
        select: { id: true, coinsGranted: true },
      });
      if (!updated || !updated.coinsGranted || updated.coinsGranted <= 0) {
        this.logger.warn(
          `Order for session ${session.id} has no coinsGranted — skipping balance adjust`,
        );
        return;
      }
      await this.coins.adjustBalance(
        userId,
        updated.coinsGranted,
        COIN_TXN_TYPE.PURCHASE,
        updated.id,
        tx,
      );
    });
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

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: {
        userId,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        status: sub.status,
        currentPeriodStart: this.fromStripeTimestamp(
          (sub as Stripe.Subscription & { current_period_start?: number }).current_period_start,
        ),
        currentPeriodEnd: this.fromStripeTimestamp(
          (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end,
        ),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        canceledAt: sub.canceled_at ? this.fromStripeTimestamp(sub.canceled_at) : null,
      },
      update: {
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        status: sub.status,
        currentPeriodStart: this.fromStripeTimestamp(
          (sub as Stripe.Subscription & { current_period_start?: number }).current_period_start,
        ),
        currentPeriodEnd: this.fromStripeTimestamp(
          (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end,
        ),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        canceledAt: sub.canceled_at ? this.fromStripeTimestamp(sub.canceled_at) : null,
      },
    });
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

    await this.prisma.$transaction(async (tx) => {
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

  private fromStripeTimestamp(secondsSinceEpoch?: number | null): Date {
    if (!secondsSinceEpoch) return new Date();
    return new Date(secondsSinceEpoch * 1000);
  }
}
