'use client';

import { Check } from 'lucide-react';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@novelhub/shared';

import { cn } from '@/lib/utils';
import { messages } from '@novelhub/shared';

export function SubscribeTab({
  selectedPlan,
  onSelectPlan,
}: {
  selectedPlan: SubscriptionPlanId;
  onSelectPlan: (plan: SubscriptionPlanId) => void;
}): JSX.Element {
  const plans = [SUBSCRIPTION_PLANS.weekly, SUBSCRIPTION_PLANS.monthly];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {plans.map((plan) => {
          const selected = selectedPlan === plan.id;
          const monthly = plan.id === 'monthly';
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelectPlan(plan.id)}
              className={cn(
                'relative min-h-28 rounded-lg border p-3 text-left transition-colors',
                selected ? 'border-brand bg-brand/10' : 'border-border bg-background',
              )}
            >
              {monthly ? (
                <span className="absolute right-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                  {messages.paywall.bestValue}
                </span>
              ) : null}
              <p className="text-sm font-semibold">
                {plan.id === 'weekly' ? messages.paywall.weekly : messages.paywall.monthly}
              </p>
              <p className="mt-4 text-xl font-bold">${plan.priceUsd.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                {plan.id === 'weekly' ? messages.paywall.perWeek : messages.paywall.perMonth}
              </p>
            </button>
          );
        })}
      </div>
      <ul className="space-y-2 text-sm">
        {[
          messages.paywall.benefitUnlimited,
          messages.paywall.benefitAllBooks,
          messages.paywall.benefitCancel,
        ].map((benefit) => (
          <li key={benefit} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-brand" />
            {benefit}
          </li>
        ))}
      </ul>
    </div>
  );
}
