import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS } from '@novelhub/shared';

import {
  formatAccountDate,
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
  it('getInitials: trims whitespace and uses only the first email character', () => {
    expect(getInitials('luna@example.com')).toBe('L');
    expect(getInitials('  nova.reader@example.com')).toBe('N');
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });

  it('formatAccountDate: formats ISO dates with the account date formatter', () => {
    expect(formatAccountDate('2026-05-06T12:00:00.000Z')).toBe('May 6, 2026');
  });

  it('formatRelativeTimestamp: formats recent deltas and clamps future timestamps to just now', () => {
    const now = new Date('2026-05-06T12:00:00.000Z').getTime();

    expect(formatRelativeTimestamp('2026-05-06T12:00:00.000Z', relativeMessages, now)).toBe(
      'just now',
    );
    expect(formatRelativeTimestamp('2026-05-06T12:01:00.000Z', relativeMessages, now)).toBe(
      'just now',
    );
    expect(formatRelativeTimestamp('2026-05-06T11:58:00.000Z', relativeMessages, now)).toBe(
      '2m ago',
    );
    expect(formatRelativeTimestamp('2026-05-06T11:01:00.000Z', relativeMessages, now)).toBe(
      '59m ago',
    );
    expect(formatRelativeTimestamp('2026-05-06T11:00:00.000Z', relativeMessages, now)).toBe(
      '1h ago',
    );
    expect(formatRelativeTimestamp('2026-05-06T09:00:00.000Z', relativeMessages, now)).toBe(
      '3h ago',
    );
    expect(formatRelativeTimestamp('2026-05-05T13:00:00.000Z', relativeMessages, now)).toBe(
      '23h ago',
    );
    expect(formatRelativeTimestamp('2026-05-05T12:00:00.000Z', relativeMessages, now)).toBe(
      '1d ago',
    );
    expect(formatRelativeTimestamp('2026-04-07T12:00:00.000Z', relativeMessages, now)).toBe(
      '29d ago',
    );
    expect(formatRelativeTimestamp('2026-04-06T12:00:00.000Z', relativeMessages, now)).toBe(
      'Apr 6, 2026',
    );
  });

  it('transaction helpers: expose sign and color for positive, zero, and negative amounts', () => {
    expect(formatTransactionAmount(20)).toBe('+20');
    expect(formatTransactionAmount(0)).toBe('0');
    expect(formatTransactionAmount(-5)).toBe('-5');
    expect(getTransactionAmountClass(1)).toBe('text-emerald-600');
    expect(getTransactionAmountClass(0)).toBe('text-emerald-600');
    expect(getTransactionAmountClass(-1)).toBe('text-red-600');
  });

  it('formatSubscriptionPlanName: uses shared subscription plan label fallbacks', () => {
    expect(formatSubscriptionPlanName('weekly')).toBe(SUBSCRIPTION_PLANS.weekly.label);
    expect(formatSubscriptionPlanName('monthly')).toBe(SUBSCRIPTION_PLANS.monthly.label);
  });
});
