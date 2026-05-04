export const APP_NAME = 'NovelHub' as const;

export const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled', 'expired'] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
