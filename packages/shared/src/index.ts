export const APP_NAME = 'NovelHub' as const;

export * from './consent';
export * from './push-copy';
export * from './routes';
export * from './sentry-scrubber';

export const BOOK_STATUSES = ['ONGOING', 'COMPLETED'] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];
export const BOOK_STATUS = {
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
} as const satisfies Record<string, BookStatus>;

export const PUSH_PERMISSION_REWARD_COINS = 10;

export const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled', 'expired'] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Named lookups for the same status values, so call sites can write
 * `SUBSCRIPTION_STATUS.CANCELED` instead of the literal `'canceled'`.
 */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const satisfies Record<string, SubscriptionStatus>;

/**
 * Coin packages offered for one-time purchase. `priceUsd` is the customer-
 * facing price; the inline price_data sent to Stripe converts to cents.
 * Bonus tiers grow with pack size as a soft anchor toward the highest LTV pack.
 */
export const COIN_PACKAGES = {
  pack_50: { id: 'pack_50', priceUsd: 4.99, coins: 50, label: '50 coins' },
  pack_120: {
    id: 'pack_120',
    priceUsd: 9.99,
    coins: 120,
    label: '120 coins (+20%)',
  },
  pack_260: {
    id: 'pack_260',
    priceUsd: 19.99,
    coins: 260,
    label: '260 coins (+30%)',
  },
  pack_700: {
    id: 'pack_700',
    priceUsd: 49.99,
    coins: 700,
    label: '700 coins (+40%)',
  },
} as const;

export type CoinPackageId = keyof typeof COIN_PACKAGES;

export const COIN_PACKAGE_IDS = Object.keys(COIN_PACKAGES) as CoinPackageId[];

export const SUBSCRIPTION_PLANS = {
  weekly: { id: 'weekly', priceUsd: 12.99, label: 'Weekly' },
  monthly: { id: 'monthly', priceUsd: 29.99, label: 'Monthly' },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

export const SUBSCRIPTION_PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanId[];

export const ORDER_TYPE = {
  COIN_PURCHASE: 'COIN_PURCHASE',
  SUBSCRIPTION: 'SUBSCRIPTION',
} as const;

export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

export const ORDER_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * Public-facing app paths the API needs to reference (e.g. when constructing
 * Stripe success/cancel/return URLs). Centralised here so the backend never
 * hardcodes frontend routes.
 */
export const PAYMENT_PATHS = {
  /** Stripe expands {CHECKOUT_SESSION_ID} on redirect — leave the placeholder. */
  SUCCESS: '/payment/success?session_id={CHECKOUT_SESSION_ID}',
  CANCEL: '/payment/cancel',
  /** Customer Portal sends users back here after managing their subscription. */
  PORTAL_RETURN: '/me',
} as const;

/**
 * Stripe Checkout shows this string to paying customers as the line-item
 * "product name". Built from the package label rather than hardcoded so
 * downstream tooling can swap copy without touching call sites.
 */
export const buildCoinPackageProductName = (packageLabel: string): string =>
  `${APP_NAME} — ${packageLabel}`;

export default APP_NAME;
