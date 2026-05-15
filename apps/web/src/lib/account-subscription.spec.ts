import { describe, expect, it } from 'vitest';

import { getAccountSubscriptionNotice } from './account-subscription';
import type { SubscriptionSummary } from './types';

const baseSubscription: SubscriptionSummary = {
  plan: 'monthly',
  status: 'active',
  currentPeriodEnd: '2026-05-20T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  canceledAt: null,
};

describe('getAccountSubscriptionNotice', () => {
  it('returns past_due grace copy and manage billing CTA context', () => {
    expect(
      getAccountSubscriptionNotice({
        ...baseSubscription,
        status: 'past_due',
      }),
    ).toEqual({
      variant: 'past_due',
      title: 'Payment issue — access is still active',
      body: 'We could not renew your subscription. Your reading access remains active during the grace period while Stripe retries the payment.',
      renewalLabel: 'Grace period ends on May 20, 2026',
      ctaLabel: 'Manage payment method',
    });
  });

  it('preserves active renewal copy for healthy subscriptions', () => {
    expect(getAccountSubscriptionNotice(baseSubscription)).toEqual({
      variant: 'default',
      renewalLabel: 'Renews on May 20, 2026',
      ctaLabel: 'Manage Subscription',
    });
  });
});
