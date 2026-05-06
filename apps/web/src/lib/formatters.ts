import type { SubscriptionPlanId } from '@novelhub/shared';

export const getInitials = (email: string): string => email.trim().slice(0, 1).toUpperCase();

export const formatAccountDate = (iso: string): string =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );

type RelativeTimestampMessages = {
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
};

const fillCount = (template: string, count: number): string =>
  template.replaceAll('{count}', () => String(count));

export const formatRelativeTimestamp = (
  iso: string,
  messages: RelativeTimestampMessages,
  now = Date.now(),
): string => {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return messages.justNow;
  if (minutes < 60) return fillCount(messages.minutesAgo, minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return fillCount(messages.hoursAgo, hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return fillCount(messages.daysAgo, days);
  return formatAccountDate(iso);
};

export const getTransactionAmountClass = (amount: number): string =>
  amount >= 0 ? 'text-emerald-600' : 'text-red-600';

export const formatTransactionAmount = (amount: number): string =>
  `${amount > 0 ? '+' : ''}${amount}`;

export const formatSubscriptionPlanName = (plan: SubscriptionPlanId): string =>
  plan === 'monthly' ? 'Monthly' : 'Weekly';
