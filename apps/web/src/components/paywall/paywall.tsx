'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  COIN_PACKAGES,
  SUBSCRIPTION_PLANS,
  type CoinPackageId,
  type SubscriptionPlanId,
} from '@novelhub/shared';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers';
import { CoinsTab } from '@/components/paywall/coins-tab';
import { SubscribeTab } from '@/components/paywall/subscribe-tab';
import { createCoinCheckout, createSubscriptionCheckout } from '@/lib/queries';
import { fbTrackAddToCart, fbTrackInitiateCheckout } from '@/lib/fb-pixel';
import { READER_RETURN_URL_KEY } from '@/lib/payment-success';
import { cn } from '@/lib/utils';
import type { LockedChapter } from '@/lib/types';
import messages from '@/../messages/en.json';

type PaywallTab = 'subscribe' | 'coins';

export function Paywall({
  chapter,
  currentUrl,
  onDismiss,
}: {
  chapter: LockedChapter;
  currentUrl: string;
  onDismiss: () => void;
}): JSX.Element {
  const { user, openAuthModal, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<PaywallTab>('subscribe');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(
    SUBSCRIPTION_PLANS.weekly.id,
  );
  const [selectedPackage, setSelectedPackage] = useState<CoinPackageId>(COIN_PACKAGES.pack_120.id);
  const [submitting, setSubmitting] = useState(false);

  const rememberReturnUrl = (): void => {
    window.sessionStorage.setItem(READER_RETURN_URL_KEY, currentUrl);
  };

  const selectPlan = (plan: SubscriptionPlanId): void => {
    setSelectedPlan(plan);
    fbTrackAddToCart({
      value: SUBSCRIPTION_PLANS[plan].priceUsd,
      currency: 'USD',
      contentIds: [plan],
    });
  };

  const selectPackage = (packageId: CoinPackageId): void => {
    setSelectedPackage(packageId);
    fbTrackAddToCart({
      value: COIN_PACKAGES[packageId].priceUsd,
      currency: 'USD',
      contentIds: [packageId],
    });
  };

  const runSubscriptionCheckout = async (): Promise<void> => {
    setSubmitting(true);
    try {
      rememberReturnUrl();
      fbTrackInitiateCheckout({
        value: SUBSCRIPTION_PLANS[selectedPlan].priceUsd,
        currency: 'USD',
      });
      const checkout = await createSubscriptionCheckout(selectedPlan);
      window.location.assign(checkout.url);
    } catch {
      toast.error(messages.paywall.checkoutError);
      setSubmitting(false);
    }
  };

  const startSubscriptionCheckout = async (): Promise<void> => {
    // Wait for /auth/me to resolve before deciding signed-in vs anonymous;
    // otherwise a logged-in user racing the page load gets the auth modal
    // they don't need (and a 401 toast if checkout fires before the JWT
    // cookie arrives).
    if (authLoading) return;
    if (!user) {
      openAuthModal({
        mode: 'signin',
        reason: 'paywall',
        afterSuccess: () => {
          void runSubscriptionCheckout();
        },
      });
      return;
    }
    await runSubscriptionCheckout();
  };

  const runCoinCheckout = async (): Promise<void> => {
    setSubmitting(true);
    try {
      rememberReturnUrl();
      fbTrackInitiateCheckout({
        value: COIN_PACKAGES[selectedPackage].priceUsd,
        currency: 'USD',
      });
      const checkout = await createCoinCheckout(selectedPackage);
      window.location.assign(checkout.url);
    } catch {
      toast.error(messages.paywall.checkoutError);
      setSubmitting(false);
    }
  };

  const startCoinCheckout = async (): Promise<void> => {
    if (authLoading) return;
    if (!user) {
      openAuthModal({
        mode: 'signin',
        reason: 'paywall',
        afterSuccess: () => {
          void runCoinCheckout();
        },
      });
      return;
    }
    await runCoinCheckout();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background text-foreground">
      <div className="mx-auto flex min-h-0 w-full max-w-mobile flex-1 flex-col px-5 pb-4 pt-8">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="text-sm font-semibold text-brand">{messages.paywall.title}</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight">{chapter.title}</h1>
          <div className="relative mt-5 max-h-32 overflow-hidden text-base leading-7 text-muted-foreground">
            <p className="[mask-image:linear-gradient(180deg,#000_45%,transparent_100%)]">
              {chapter.preview}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab('subscribe')}
              className={cn(
                'h-10 rounded-md text-sm font-semibold',
                tab === 'subscribe'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {messages.paywall.subscribe}
            </button>
            <button
              type="button"
              onClick={() => setTab('coins')}
              className={cn(
                'h-10 rounded-md text-sm font-semibold',
                tab === 'coins'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {messages.paywall.buyCoins}
            </button>
          </div>

          <div className="mt-5">
            {tab === 'subscribe' ? (
              <SubscribeTab selectedPlan={selectedPlan} onSelectPlan={selectPlan} />
            ) : (
              <CoinsTab selectedPackage={selectedPackage} onSelectPackage={selectPackage} />
            )}
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <Button
            type="button"
            onClick={tab === 'subscribe' ? startSubscriptionCheckout : startCoinCheckout}
            disabled={submitting}
            className="h-12 w-full bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
          >
            {tab === 'subscribe' ? messages.paywall.subscribeNow : messages.paywall.buyCoinsNow}
          </Button>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/terms">{messages.paywall.terms}</Link>
            <Link href="/privacy">{messages.paywall.privacy}</Link>
            <Link href="/refund">{messages.paywall.refund}</Link>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="block w-full py-2 text-center text-xs text-muted-foreground"
          >
            {messages.paywall.maybeLater}
          </button>
        </div>
      </div>
    </div>
  );
}
