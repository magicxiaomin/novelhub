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

import { DomainError } from '../../common/domain.errors';
import { SUBSCRIPTION_ACTIVE_STATUSES } from '../auth/auth.constants';
import type { FbUserData } from '../fb-capi/fb-capi.types';

import { type StripeClient } from './stripe.client';
import { METADATA_KEY } from './stripe.constants';

export type SubscriptionPriceIds = {
  weekly: string | undefined;
  monthly: string | undefined;
};

export type PaymentsServiceDeps = {
  prisma: PrismaClient;
  stripe: StripeClient;
  appUrl: string;
  subscriptionPriceIds: SubscriptionPriceIds;
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

const log = {
  warn(msg: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[PaymentsService] ${msg}`);
  },
};

export class PaymentsService {
  private readonly prisma: PrismaClient;
  private readonly stripe: StripeClient;
  private readonly appUrl: string;
  private readonly subscriptionPriceIds: SubscriptionPriceIds;

  constructor(deps: PaymentsServiceDeps) {
    this.prisma = deps.prisma;
    this.stripe = deps.stripe;
    this.appUrl = deps.appUrl;
    this.subscriptionPriceIds = deps.subscriptionPriceIds;
  }

  async createCoinCheckout(
    userId: string,
    packageId: CoinPackageId,
    fbMetadata: CheckoutFbMetadata = { fbConsent: false, fbUserData: null },
    returnUrl?: string,
  ): Promise<{ url: string; sessionId: string }> {
    const pkg = COIN_PACKAGES[packageId];
    if (!pkg) {
      throw DomainError.badRequest(`Unknown coin package: ${packageId}`);
    }
    const user = await this.requireUser(userId);

    const stripe = this.stripe.get();
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
      success_url: this.successUrl(returnUrl),
      cancel_url: `${this.appUrl}${PAYMENT_PATHS.CANCEL}`,
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
      throw DomainError.badRequest('Stripe did not return a checkout URL');
    }
    return { url: session.url, sessionId: session.id };
  }

  async createSubscriptionCheckout(
    userId: string,
    plan: SubscriptionPlanId,
    fbMetadata: CheckoutFbMetadata = { fbConsent: false, fbUserData: null },
    returnUrl?: string,
  ): Promise<{ url: string; sessionId: string }> {
    const planMeta = SUBSCRIPTION_PLANS[plan];
    if (!planMeta) {
      throw DomainError.badRequest(`Unknown subscription plan: ${plan}`);
    }
    const user = await this.requireUser(userId);
    const priceId = this.requireSubscriptionPriceId(plan);

    const stripe = this.stripe.get();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...this.customerIdentity(user),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.successUrl(returnUrl),
      cancel_url: `${this.appUrl}${PAYMENT_PATHS.CANCEL}`,
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
      throw DomainError.badRequest('Stripe did not return a checkout URL');
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
      throw DomainError.notFound('No Stripe customer for this user; subscribe first');
    }
    const stripe = this.stripe.get();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.appUrl}${PAYMENT_PATHS.PORTAL_RETURN}`,
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
            ? this.subscriptionPriceIds.weekly
            : this.subscriptionPriceIds.monthly;
        return priceId === sub.stripePriceId;
      })?.id as SubscriptionPlanId | undefined) ?? 'weekly';

    if (plan === 'weekly' && sub.stripePriceId !== this.subscriptionPriceIds.weekly) {
      log.warn(`Unknown subscription price id ${sub.stripePriceId}; defaulting to weekly`);
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
      throw DomainError.notFound('Order not found');
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

  private requireSubscriptionPriceId(plan: SubscriptionPlanId): string {
    const value =
      plan === 'weekly' ? this.subscriptionPriceIds.weekly : this.subscriptionPriceIds.monthly;
    if (!value) {
      const envKey = plan === 'weekly' ? 'STRIPE_PRICE_WEEKLY' : 'STRIPE_PRICE_MONTHLY';
      throw DomainError.badRequest(`Subscription plan ${plan} is not configured (${envKey} unset)`);
    }
    return value;
  }

  private successUrl(returnUrl?: string): string {
    const successUrl = `${this.appUrl}${PAYMENT_PATHS.SUCCESS}`;
    if (!this.isSafeReaderReturnUrl(returnUrl)) return successUrl;
    const separator = successUrl.includes('?') ? '&' : '?';
    return `${successUrl}${separator}return_url=${encodeURIComponent(returnUrl)}`;
  }

  private isSafeReaderReturnUrl(returnUrl?: string): returnUrl is string {
    if (!returnUrl) return false;
    try {
      const appOrigin = new URL(this.appUrl).origin;
      const url = new URL(returnUrl, this.appUrl);
      return url.origin === appOrigin && url.pathname.startsWith('/read/');
    } catch {
      return false;
    }
  }

  private async requireUser(
    userId: string,
  ): Promise<{ id: string; email: string; stripeCustomerId: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, stripeCustomerId: true, deletedAt: true, bannedAt: true },
    });
    if (!user || user.deletedAt || user.bannedAt) {
      throw DomainError.unauthorized();
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
      log.warn(
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
