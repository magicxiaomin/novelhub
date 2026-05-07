'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  COIN_PACKAGES,
  SUBSCRIPTION_PLANS,
  type CoinPackageId,
  type SubscriptionPlanId,
} from '@novelhub/shared';

import { AppShell } from '@/components/layout/app-shell';
import { CoinsTab } from '@/components/paywall/coins-tab';
import { SubscribeTab } from '@/components/paywall/subscribe-tab';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createCoinCheckout,
  createSubscriptionCheckout,
  fetchCoinTransactions,
  queryKeys,
} from '@/lib/queries';
import { fbTrackAddToCart, fbTrackInitiateCheckout } from '@/lib/fb-pixel';
import {
  formatRelativeTimestamp,
  formatTransactionAmount,
  getTransactionAmountClass,
} from '@/lib/formatters';
import { cn } from '@/lib/utils';
import messages from '@/../messages/en.json';

type RechargeTab = 'coins' | 'subscribe';

const fill = (template: string, values: Record<string, string>): string => {
  let result = template;
  for (const [token, value] of Object.entries(values)) {
    result = result.replaceAll(`{${token}}`, () => value);
  }
  return result;
};

export function RechargeClient(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, openAuthModal } = useAuth();
  const initialTab: RechargeTab = searchParams.get('tab') === 'subscribe' ? 'subscribe' : 'coins';
  const [tab, setTab] = useState<RechargeTab>(initialTab);
  const [selectedPackage, setSelectedPackage] = useState<CoinPackageId>(COIN_PACKAGES.pack_120.id);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(
    SUBSCRIPTION_PLANS.weekly.id,
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isLoading || user) return;
    openAuthModal({ mode: 'signin' });
  }, [isLoading, openAuthModal, user]);

  const transactions = useQuery({
    queryKey: queryKeys.coinTransactions(1, 20),
    queryFn: () => fetchCoinTransactions(1, 20),
    enabled: Boolean(user),
  });
  const coinCheckout = useMutation({
    mutationFn: createCoinCheckout,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: () => toast.error(messages.recharge.checkoutError),
  });
  const subscriptionCheckout = useMutation({
    mutationFn: createSubscriptionCheckout,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: () => toast.error(messages.recharge.checkoutError),
  });

  const transactionLabels = useMemo(() => messages.recharge as Record<string, string>, []);

  const selectPackage = (packageId: CoinPackageId): void => {
    setSelectedPackage(packageId);
    fbTrackAddToCart({
      value: COIN_PACKAGES[packageId].priceUsd,
      currency: 'USD',
      contentIds: [packageId],
    });
  };

  const selectPlan = (plan: SubscriptionPlanId): void => {
    setSelectedPlan(plan);
    fbTrackAddToCart({
      value: SUBSCRIPTION_PLANS[plan].priceUsd,
      currency: 'USD',
      contentIds: [plan],
    });
  };

  const buyCoins = (): void => {
    fbTrackInitiateCheckout({
      value: COIN_PACKAGES[selectedPackage].priceUsd,
      currency: 'USD',
    });
    coinCheckout.mutate(selectedPackage);
  };

  const subscribe = (): void => {
    fbTrackInitiateCheckout({
      value: SUBSCRIPTION_PLANS[selectedPlan].priceUsd,
      currency: 'USD',
    });
    subscriptionCheckout.mutate(selectedPlan);
  };

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="space-y-4 px-5 py-6">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </AppShell>
    );
  }

  const setTabAndUrl = (nextTab: RechargeTab): void => {
    setTab(nextTab);
    router.replace(nextTab === 'subscribe' ? '/recharge?tab=subscribe' : '/recharge');
  };

  return (
    <AppShell>
      <div className="space-y-5 px-5 py-6">
        <header>
          <h1 className="text-2xl font-bold">{messages.recharge.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fill(messages.recharge.balance, { balance: String(user.coinBalance) })}
          </p>
        </header>

        <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTabAndUrl('coins')}
            className={cn(
              'h-10 rounded-md text-sm font-semibold',
              tab === 'coins' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {messages.recharge.buyCoins}
          </button>
          <button
            type="button"
            onClick={() => setTabAndUrl('subscribe')}
            className={cn(
              'h-10 rounded-md text-sm font-semibold',
              tab === 'subscribe'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            {messages.recharge.subscribe}
          </button>
        </div>

        <Card className="rounded-lg">
          <CardContent className="pt-4">
            {tab === 'coins' ? (
              <div className="space-y-4">
                <CoinsTab selectedPackage={selectedPackage} onSelectPackage={selectPackage} />
                <Button
                  type="button"
                  disabled={coinCheckout.isPending}
                  onClick={buyCoins}
                  className="h-12 w-full bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {messages.recharge.buyCoinsNow}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <SubscribeTab selectedPlan={selectedPlan} onSelectPlan={selectPlan} />
                <Button
                  type="button"
                  disabled={subscriptionCheckout.isPending}
                  onClick={subscribe}
                  className="h-12 w-full bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {messages.recharge.subscribeNow}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <h2 className="text-lg font-semibold">{messages.recharge.transactions}</h2>
          </CardHeader>
          <CardContent>
            {transactions.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : (transactions.data?.items ?? []).length > 0 ? (
              <div className="divide-y">
                {(transactions.data?.items ?? []).map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {transactionLabels[`type_${txn.type}`] ?? messages.recharge.type_UNKNOWN}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTimestamp(txn.createdAt, {
                          justNow: messages.recharge.justNow,
                          minutesAgo: messages.recharge.minutesAgo,
                          hoursAgo: messages.recharge.hoursAgo,
                          daysAgo: messages.recharge.daysAgo,
                        })}
                      </p>
                    </div>
                    <p className={cn('font-semibold', getTransactionAmountClass(txn.amount))}>
                      {formatTransactionAmount(txn.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{messages.recharge.emptyTransactions}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
