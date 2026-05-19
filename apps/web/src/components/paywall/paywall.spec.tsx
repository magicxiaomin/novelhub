import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LockedChapter } from '@/lib/types';

const paywallMocks = vi.hoisted(() => ({
  createCoinCheckout: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  fbTrackAddToCart: vi.fn(),
  fbTrackInitiateCheckout: vi.fn(),
  openAuthModal: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('sonner', () => ({ toast: { error: paywallMocks.toastError } }));
vi.mock('@/components/providers', () => ({
  useAuth: () => ({
    user: null,
    openAuthModal: paywallMocks.openAuthModal,
    isLoading: false,
  }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    disabled,
    type,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    variant?: string;
  }) =>
    React.createElement(
      'button',
      {
        className,
        disabled,
        type,
        'data-variant': variant,
      },
      children,
    ),
}));
vi.mock('@/components/paywall/subscribe-tab', () => ({
  SubscribeTab: ({
    selectedPlan,
  }: {
    selectedPlan: string;
    onSelectPlan: (plan: string) => void;
  }) =>
    React.createElement('section', {
      'data-paywall-subscribe-tab': true,
      'data-selected-plan': selectedPlan,
    }),
}));
vi.mock('@/components/paywall/coins-tab', () => ({
  CoinsTab: ({
    selectedPackage,
  }: {
    selectedPackage: string;
    onSelectPackage: (packageId: string) => void;
  }) =>
    React.createElement('section', {
      'data-paywall-coins-tab': true,
      'data-selected-package': selectedPackage,
    }),
}));
vi.mock('@/lib/queries', () => ({
  createCoinCheckout: paywallMocks.createCoinCheckout,
  createSubscriptionCheckout: paywallMocks.createSubscriptionCheckout,
}));
vi.mock('@/lib/fb-pixel', () => ({
  fbTrackAddToCart: paywallMocks.fbTrackAddToCart,
  fbTrackInitiateCheckout: paywallMocks.fbTrackInitiateCheckout,
}));
vi.mock('@/lib/payment-success', () => ({ READER_RETURN_URL_KEY: 'novelhub:return-url' }));
vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' '),
}));

import { Paywall } from './paywall';

const lockedChapter: LockedChapter = {
  id: 'chapter-locked-1',
  bookId: 'book-paywall-1',
  chapterNumber: 7,
  title: 'Chapter 7: The Locked Door',
  isLocked: true,
  preview: 'The door opened just enough to reveal a cliffhanger preview.',
  unlockOptions: {
    coinCost: 30,
    canUnlockWithCoins: true,
    canUnlockWithSubscription: true,
  },
};

beforeEach(() => {
  vi.stubGlobal('React', React);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Paywall static render', () => {
  it('renders the locked chapter copy, default subscribe tab, CTAs, and policy links without checkout side effects', () => {
    const html = renderToStaticMarkup(
      <Paywall chapter={lockedChapter} currentUrl="/read/book-paywall-1/7" onDismiss={vi.fn()} />,
    );

    expect(html).toContain('Chapter locked');
    expect(html).toContain(
      'Keep reading with unlimited novel access or unlock chapters with coins.',
    );
    expect(html).toContain('Chapter 7: The Locked Door');
    expect(html).toContain('The door opened just enough to reveal a cliffhanger preview.');
    expect(html).toContain('data-paywall-subscribe-tab="true"');
    expect(html).toContain('data-selected-plan="weekly"');
    expect(html).not.toContain('data-paywall-coins-tab="true"');
    expect(html).toContain('Subscribe Now');
    expect(html).toContain('Buy Coins Now');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/refund"');
    expect(html).toContain('Maybe later');

    expect(paywallMocks.openAuthModal).not.toHaveBeenCalled();
    expect(paywallMocks.createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(paywallMocks.createCoinCheckout).not.toHaveBeenCalled();
    expect(paywallMocks.fbTrackAddToCart).not.toHaveBeenCalled();
    expect(paywallMocks.fbTrackInitiateCheckout).not.toHaveBeenCalled();
    expect(paywallMocks.toastError).not.toHaveBeenCalled();
  });
});
