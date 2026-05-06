import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS } from '@novelhub/shared';

import {
  formatRelativeTimestamp,
  formatSubscriptionPlanName,
  formatTransactionAmount,
  getInitials,
  getTransactionAmountClass,
} from './formatters';

const relativeMessages = {
  justNow: 'just now',
  minutesAgo: '{count}m ago',
  hoursAgo: '{count}h ago',
  daysAgo: '{count}d ago',
};

describe('formatters', () => {
  it('getInitials: uses the first email character', () => {
    expect(getInitials('luna@example.com')).toBe('L');
  });

  it('formatRelativeTimestamp: formats recent deltas', () => {
    const now = new Date('2026-05-06T12:00:00.000Z').getTime();
    expect(formatRelativeTimestamp('2026-05-06T11:58:00.000Z', relativeMessages, now)).toBe(
      '2m ago',
    );
    expect(formatRelativeTimestamp('2026-05-06T09:00:00.000Z', relativeMessages, now)).toBe(
      '3h ago',
    );
  });

  it('transaction helpers: expose sign and color', () => {
    expect(formatTransactionAmount(20)).toBe('+20');
    expect(formatTransactionAmount(-5)).toBe('-5');
    expect(getTransactionAmountClass(1)).toBe('text-emerald-600');
    expect(getTransactionAmountClass(-1)).toBe('text-red-600');
  });

  it('formatSubscriptionPlanName: uses shared plan labels', () => {
    expect(formatSubscriptionPlanName('weekly')).toBe(SUBSCRIPTION_PLANS.weekly.label);
    expect(formatSubscriptionPlanName('monthly')).toBe(SUBSCRIPTION_PLANS.monthly.label);
  });
});
