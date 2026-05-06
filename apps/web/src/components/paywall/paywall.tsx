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
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<PaywallTab>('subscribe');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(
    SUBSCRIPTION_PLANS.weekly.id,
  );
  const [selectedPackage, setSelectedPackage] = useState<CoinPackageId>(COIN_PACKAGES.pack_120.id);
  const [showLogin, setShowLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requireLogin = (): boolean => {
    if (user || isLoading) return false;
    setShowLogin(true);
    return true;
  };

  const rememberReturnUrl = (): void => {
    window.sessionStorage.setItem(READER_RETURN_URL_KEY, currentUrl);
  };

  const startSubscriptionCheckout = async (): Promise<void> => {
    if (requireLogin()) return;
    setSubmitting(true);
    try {
      rememberReturnUrl();
      const checkout = await createSubscriptionCheckout(selectedPlan);
      window.location.assign(checkout.url);
    } catch {
      toast.error(messages.paywall.checkoutError);
      setSubmitting(false);
    }
  };

  const startCoinCheckout = async (): Promise<void> => {
    if (requireLogin()) return;
    setSubmitting(true);
    try {
      rememberReturnUrl();
      const checkout = await createCoinCheckout(selectedPackage);
      window.location.assign(checkout.url);
    } catch {
      toast.error(messages.paywall.checkoutError);
      setSubmitting(false);
    }
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
              <SubscribeTab selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan} />
            ) : (
              <CoinsTab selectedPackage={selectedPackage} onSelectPackage={setSelectedPackage} />
            )}
          </div>

          {showLogin ? (
            <LoginRequiredDialog currentUrl={currentUrl} onClose={() => setShowLogin(false)} />
          ) : null}
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

function LoginRequiredDialog({
  currentUrl,
  onClose,
}: {
  currentUrl: string;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-login-title"
        className="w-full max-w-sm rounded-lg bg-background p-5 text-foreground shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="paywall-login-title" className="text-lg font-semibold">
          {messages.paywall.loginRequired}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{messages.paywall.loginBody}</p>
        <div className="mt-5 grid gap-3">
          <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
            <Link href={`/login?next=${encodeURIComponent(currentUrl)}`}>
              {messages.paywall.loginCta}
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onClose} className="w-full">
            {messages.paywall.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
