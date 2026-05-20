import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LockedChapter } from '@/lib/types';

const paywallMocks = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string },
    isLoading: false,
  },
  buttons: [] as Array<{ label: string; onClick?: () => void | Promise<void> }>,
  createCoinCheckout: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  fbTrackAddToCart: vi.fn(),
  fbTrackInitiateCheckout: vi.fn(),
  locationAssign: vi.fn(),
  openAuthModal: vi.fn(),
  sessionStorage: new Map<string, string>(),
  toastError: vi.fn(),
}));

vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('sonner', () => ({ toast: { error: paywallMocks.toastError } }));
vi.mock('@/components/providers', () => ({
  useAuth: () => ({
    user: paywallMocks.auth.user,
    openAuthModal: paywallMocks.openAuthModal,
    isLoading: paywallMocks.auth.isLoading,
  }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    disabled,
    onClick,
    type,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void | Promise<void>;
    type?: 'button' | 'submit' | 'reset';
    variant?: string;
  }) => {
    paywallMocks.buttons.push({ label: String(children), onClick });
    return React.createElement(
      'button',
      {
        className,
        disabled,
        type,
        'data-variant': variant,
      },
      children,
    );
  },
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
  paywallMocks.auth.user = null;
  paywallMocks.auth.isLoading = false;
  paywallMocks.buttons.length = 0;
  paywallMocks.sessionStorage.clear();
  vi.stubGlobal('window', {
    location: { assign: paywallMocks.locationAssign },
    sessionStorage: {
      getItem: (key: string) => paywallMocks.sessionStorage.get(key) ?? null,
      setItem: (key: string, value: string) => paywallMocks.sessionStorage.set(key, value),
    },
  });
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

  it('stores and passes the reader return URL for signed-in subscription checkout', async () => {
    paywallMocks.auth.user = { id: 'user-paywall-1' };
    paywallMocks.createSubscriptionCheckout.mockResolvedValue({
      url: 'https://checkout.stripe.test/subscription',
      sessionId: 'cs_subscription',
    });
    renderToStaticMarkup(
      <Paywall
        chapter={lockedChapter}
        currentUrl="/read/book-paywall-1/7?anchor=paywall"
        onDismiss={vi.fn()}
      />,
    );

    await clickPaywallButton('Subscribe Now');

    expect(paywallMocks.sessionStorage.get('novelhub:return-url')).toBe(
      '/read/book-paywall-1/7?anchor=paywall',
    );
    expect(paywallMocks.createSubscriptionCheckout).toHaveBeenCalledWith(
      'weekly',
      '/read/book-paywall-1/7?anchor=paywall',
    );
    expect(paywallMocks.fbTrackInitiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 12.99,
        currency: 'USD',
        contentIds: ['chapter-locked-1'],
        novelId: 'book-paywall-1',
        chapterId: 'chapter-locked-1',
      }),
    );
    expect(paywallMocks.locationAssign).toHaveBeenCalledWith(
      'https://checkout.stripe.test/subscription',
    );
  });

  it('defers coin checkout until auth succeeds while preserving the return context callback', async () => {
    paywallMocks.createCoinCheckout.mockResolvedValue({
      url: 'https://checkout.stripe.test/coins',
      sessionId: 'cs_coins',
    });
    renderToStaticMarkup(
      <Paywall chapter={lockedChapter} currentUrl="/read/book-paywall-1/7" onDismiss={vi.fn()} />,
    );

    await clickPaywallButton('Buy Coins Now');

    expect(paywallMocks.openAuthModal).toHaveBeenCalledWith({
      mode: 'signin',
      reason: 'paywall',
      afterSuccess: expect.any(Function),
    });
    expect(paywallMocks.createCoinCheckout).not.toHaveBeenCalled();

    const [{ afterSuccess }] = paywallMocks.openAuthModal.mock.calls[0] as [
      { afterSuccess: () => void },
    ];
    afterSuccess();
    await Promise.resolve();

    expect(paywallMocks.sessionStorage.get('novelhub:return-url')).toBe('/read/book-paywall-1/7');
    expect(paywallMocks.createCoinCheckout).toHaveBeenCalledWith(
      'pack_120',
      '/read/book-paywall-1/7',
    );
    expect(paywallMocks.locationAssign).toHaveBeenCalledWith('https://checkout.stripe.test/coins');
  });
});

async function clickPaywallButton(label: string): Promise<void> {
  const button = paywallMocks.buttons.find((candidate) => candidate.label === label);
  expect(button?.onClick).toBeTypeOf('function');
  await button?.onClick?.();
}
