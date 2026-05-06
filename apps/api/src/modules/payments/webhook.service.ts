import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { ORDER_STATUS, ORDER_TYPE } from '@novelhub/shared';
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

    // Atomic completion: only flips PENDING → COMPLETED if it's still PENDING.
    // updateMany with status filter is the idempotency guard against duplicate
    // webhook delivery — a second event sees count=0 and skips.
    const completed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          stripeSessionId: session.id,
          status: ORDER_STATUS.PENDING,
        },
        data: {
          status: ORDER_STATUS.COMPLETED,
          completedAt: new Date(),
          stripePaymentIntent:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
        },
      });
      if (result.count === 0) {
        // Either the order wasn't pre-created (fall-through), or it's already
        // completed (duplicate webhook). Try to find an existing completed
        // row first; if none, create one now.
        const existing = await tx.order.findUnique({
          where: { stripeSessionId: session.id },
          select: { status: true, coinsGranted: true },
        });
        if (existing && existing.status === ORDER_STATUS.COMPLETED) {
          return null;
        }
        if (!existing) {
          await tx.order.create({
            data: {
              userId,
              stripeSessionId: session.id,
              type: ORDER_TYPE.COIN_PURCHASE,
              amount: session.amount_total ?? 0,
              currency: (session.currency ?? 'usd').toLowerCase(),
              status: ORDER_STATUS.COMPLETED,
              completedAt: new Date(),
              metadata: { packageId, recovered: true },
              stripePaymentIntent:
                typeof session.payment_intent === 'string' ? session.payment_intent : null,
            },
          });
        }
        // Fall through — we just need to grant coins exactly once.
      }

      const updated = await tx.order.findUnique({
        where: { stripeSessionId: session.id },
        select: { id: true, coinsGranted: true },
      });
      return updated;
    });

    if (!completed) {
      this.logger.log(`Skipping coin grant for session ${session.id} — already completed`);
      return;
    }

    const coins = completed.coinsGranted;
    if (!coins || coins <= 0) {
      this.logger.warn(`Coin order ${completed.id} has no coinsGranted — skipping balance adjust`);
      return;
    }

    await this.coins.adjustBalance(userId, coins, COIN_TXN_TYPE.PURCHASE, completed.id);
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
    const periodStart = new Date(
      (sub as Stripe.Subscription & { current_period_start?: number }).current_period_start ??
        Math.floor(Date.now() / 1000),
    );
    const periodEnd = new Date(
      ((sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ??
        Math.floor(Date.now() / 1000)) * 1000,
    );

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
    void periodStart;
    void periodEnd;
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status: 'canceled',
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
      data: { status: 'past_due' },
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
