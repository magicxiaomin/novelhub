import { messages } from '@novelhub/shared';

import { formatAccountDate } from './formatters';
import type { SubscriptionSummary } from './types';

export type AccountSubscriptionNotice =
  | {
      variant: 'past_due';
      title: string;
      body: string;
      renewalLabel: string;
      ctaLabel: string;
    }
  | {
      variant: 'default';
      renewalLabel: string;
      ctaLabel: string;
    };

const fill = (template: string, values: Record<string, string>): string => {
  let result = template;
  for (const [token, value] of Object.entries(values)) {
    result = result.replaceAll(`{${token}}`, () => value);
  }
  return result;
};

export const getAccountSubscriptionNotice = (
  subscription: SubscriptionSummary,
): AccountSubscriptionNotice => {
  const date = formatAccountDate(subscription.currentPeriodEnd);

  if (subscription.status === 'past_due') {
    return {
      variant: 'past_due',
      title: messages.account.pastDueTitle,
      body: messages.account.pastDueBody,
      renewalLabel: fill(messages.account.pastDueGraceEndsOn, { date }),
      ctaLabel: messages.account.pastDueManagePayment,
    };
  }

  return {
    variant: 'default',
    renewalLabel: fill(
      subscription.cancelAtPeriodEnd ? messages.account.cancelsOn : messages.account.renewsOn,
      { date },
    ),
    ctaLabel: messages.account.manageSubscription,
  };
};
