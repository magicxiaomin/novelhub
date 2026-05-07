import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  buildCoinPackageProductName,
  COIN_PACKAGES,
  type CoinPackageId,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_PATHS,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from '@novelhub/shared';

import { PRISMA, SUBSCRIPTION_ACTIVE_STATUSES } from '../auth/auth.constants';
import type { FbUserData } from '../fb-capi/fb-capi.types';

import { type StripeClient } from './stripe.client';
import { METADATA_KEY, STRIPE_CLIENT } from './stripe.constants';

const getAppUrl = (): string => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const getSubscriptionPriceId = (plan: SubscriptionPlanId): string => {
  const envKey = plan === 'weekly' ? 'STRIPE_PRICE_WEEKLY' : 'STRIPE_PRICE_MONTHLY';
  const value = process.env[envKey];
  if (!value) {
    throw new BadRequestException(`Subscription plan ${plan} is not configured (${envKey} unset)`);
  }
  return value;
};

export type SubscriptionSummary = {
  plan: SubscriptionPlanId;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

export type CheckoutFbMetadata = {
  fbConsent: boolean;
  fbUserData: Omit<FbUserData, 'email'> | null;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
  ) {}

  async createCoinCheckout(
    userId: string,
    packageId: CoinPackageId,
    fbMetadata: CheckoutFbMetadata = { fbConsent: false, fbUserData: null },
  ): Promise<{ url: string; sessionId: string }> {
    const pkg = COIN_PACKAGES[packageId];
    if (!pkg) {
      throw new BadRequestException(`Unknown coin package: ${packageId}`);
    }
    const user = await this.requireUser(userId);

    const stripe = this.stripe.get();
    const appUrl = getAppUrl();
    const amountCents = Math.round(pkg.priceUsd * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...this.customerIdentity(user),
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: buildCoinPackageProductName(pkg.label) },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}${PAYMENT_PATHS.SUCCESS}`,
      cancel_url: `${appUrl}${PAYMENT_PATHS.CANCEL}`,
      metadata: {
        [METADATA_KEY.USER_ID]: userId,
        [METADATA_KEY.ORDER_TYPE]: ORDER_TYPE.COIN_PURCHASE,
        [METADATA_KEY.PACKAGE_ID]: packageId,
      },
    });

    await this.persistPendingOrder({
      userId,
      sessionId: session.id,
      type: ORDER_TYPE.COIN_PURCHASE,
      amountCents,
      coinsGranted: pkg.coins,
      metadata: this.orderMetadata({ packageId }, fbMetadata),
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }
    return { url: session.url, sessionId: session.id };
  }

  async createSubscriptionCheckout(
    userId: string,
    plan: SubscriptionPlanId,
    fbMetadata: CheckoutFbMetadata = { fbConsent: false, fbUserData: null },
  ): Promise<{ url: string; sessionId: string }> {
    const planMeta = SUBSCRIPTION_PLANS[plan];
    if (!planMeta) {
      throw new BadRequestException(`Unknown subscription plan: ${plan}`);
    }
    const user = await this.requireUser(userId);
    const priceId = getSubscriptionPriceId(plan);

    const stripe = this.stripe.get();
    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...this.customerIdentity(user),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${PAYMENT_PATHS.SUCCESS}`,
      cancel_url: `${appUrl}${PAYMENT_PATHS.CANCEL}`,
      metadata: {
        [METADATA_KEY.USER_ID]: userId,
        [METADATA_KEY.ORDER_TYPE]: ORDER_TYPE.SUBSCRIPTION,
        [METADATA_KEY.PLAN_ID]: plan,
      },
      subscription_data: {
        metadata: {
          [METADATA_KEY.USER_ID]: userId,
          [METADATA_KEY.PLAN_ID]: plan,
        },
      },
    });

    await this.persistPendingOrder({
      userId,
      sessionId: session.id,
      type: ORDER_TYPE.SUBSCRIPTION,
      amountCents: Math.round(planMeta.priceUsd * 100),
      coinsGranted: null,
      metadata: this.orderMetadata({ planId: plan }, fbMetadata),
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }
    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.requireUser(userId);
    // Prefer the user-level cached id (set by webhook on first checkout
    // completion). Fall back to the most-recent subscription row for users
    // whose subscription predates the User.stripeCustomerId column.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const sub = await this.prisma.subscription.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { stripeCustomerId: true },
      });
      customerId = sub?.stripeCustomerId ?? null;
    }
    if (!customerId) {
      throw new NotFoundException('No Stripe customer for this user; subscribe first');
    }
    const stripe = this.stripe.get();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}${PAYMENT_PATHS.PORTAL_RETURN}`,
    });
    return { url: portal.url };
  }

  async getActiveSubscription(userId: string): Promise<SubscriptionSummary | null> {
    await this.requireUser(userId);
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] },
        currentPeriodEnd: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        stripePriceId: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        canceledAt: true,
      },
    });
    if (!sub) return null;

    const plan =
      (Object.values(SUBSCRIPTION_PLANS).find((candidate) => {
        const priceId =
          candidate.id === 'weekly'
            ? process.env.STRIPE_PRICE_WEEKLY
            : process.env.STRIPE_PRICE_MONTHLY;
        return priceId === sub.stripePriceId;
      })?.id as SubscriptionPlanId | undefined) ?? 'weekly';

    if (plan === 'weekly' && sub.stripePriceId !== process.env.STRIPE_PRICE_WEEKLY) {
      this.logger.warn(`Unknown subscription price id ${sub.stripePriceId}; defaulting to weekly`);
    }

    return {
      plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt?.toISOString() ?? null,
    };
  }

  async getOrderStatus(
    userId: string,
    sessionId: string,
  ): Promise<{
    status: string;
    type: string;
    amount: number;
    currency: string;
    coinsGranted: number | null;
    completedAt: Date | null;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      select: {
        userId: true,
        status: true,
        type: true,
        amount: true,
        currency: true,
        coinsGranted: true,
        completedAt: true,
      },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    return {
      status: order.status,
      type: order.type,
      amount: order.amount,
      currency: order.currency,
      coinsGranted: order.coinsGranted,
      completedAt: order.completedAt,
    };
  }

  /**
   * Build the customer-identity slice of a Checkout Session create payload.
   *
   * Reusing a previously-created Stripe Customer (when we have one cached
   * on the user) avoids minting a duplicate Customer record on every
   * re-purchase, which would otherwise break the Customer Portal lookup
   * (we only see the most-recently-updated subscription's customer id).
   */
  private customerIdentity(user: {
    email: string;
    stripeCustomerId: string | null;
  }): { customer: string } | { customer_email: string } {
    if (user.stripeCustomerId) {
      return { customer: user.stripeCustomerId };
    }
    return { customer_email: user.email };
  }

  private async requireUser(
    userId: string,
  ): Promise<{ id: string; email: string; stripeCustomerId: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, stripeCustomerId: true, deletedAt: true, bannedAt: true },
    });
    if (!user || user.deletedAt || user.bannedAt) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, stripeCustomerId: user.stripeCustomerId };
  }

  private async persistPendingOrder(input: {
    userId: string;
    sessionId: string;
    type: 'COIN_PURCHASE' | 'SUBSCRIPTION';
    amountCents: number;
    coinsGranted: number | null;
    metadata: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.order.create({
        data: {
          userId: input.userId,
          stripeSessionId: input.sessionId,
          type: input.type,
          amount: input.amountCents,
          currency: 'usd',
          coinsGranted: input.coinsGranted,
          status: ORDER_STATUS.PENDING,
          metadata: input.metadata,
        },
      });
    } catch (err) {
      // If pre-create fails (e.g. transient DB error), the webhook will
      // create the row on completion. Best-effort, log only.
      this.logger.warn(
        `Failed to pre-create pending order for session ${input.sessionId}: ${(err as Error).message}`,
      );
    }
  }

  private orderMetadata(
    base: Record<string, string>,
    fbMetadata: CheckoutFbMetadata,
  ): Prisma.InputJsonObject {
    return {
      ...base,
      fbConsent: fbMetadata.fbConsent,
      fbUserData: fbMetadata.fbConsent ? this.orderFbUserData(fbMetadata.fbUserData) : null,
    };
  }

  private orderFbUserData(
    fbUserData: Omit<FbUserData, 'email'> | null,
  ): Prisma.InputJsonObject | null {
    if (!fbUserData) return null;
    return Object.fromEntries(
      Object.entries(fbUserData).filter(([, value]) => value !== undefined),
    ) as Prisma.InputJsonObject;
  }
}
