import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LockedChapter } from '@/lib/types';

const paywallMocks = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string },
    isLoading: false,
  },
  buttons: [] as Array<{ label: string; disabled?: boolean; onClick?: () => void | Promise<void> }>,
  coinsTab: null as null | {
    selectedPackage: string;
    onSelectPackage: (packageId: string) => void;
  },
  createCoinCheckout: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  fbTrackAddToCart: vi.fn(),
  fbTrackInitiateCheckout: vi.fn(),
  locationAssign: vi.fn(),
  openAuthModal: vi.fn(),
  sessionStorage: new Map<string, string>(),
  subscribeTab: null as null | { selectedPlan: string; onSelectPlan: (plan: string) => void },
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
    paywallMocks.buttons.push({ label: String(children), disabled, onClick });
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
    onSelectPlan,
    selectedPlan,
  }: {
    selectedPlan: string;
    onSelectPlan: (plan: string) => void;
  }) => {
    paywallMocks.subscribeTab = { selectedPlan, onSelectPlan };
    return React.createElement('section', {
      'data-paywall-subscribe-tab': true,
      'data-selected-plan': selectedPlan,
    });
  },
}));
vi.mock('@/components/paywall/coins-tab', () => ({
  CoinsTab: ({
    onSelectPackage,
    selectedPackage,
  }: {
    selectedPackage: string;
    onSelectPackage: (packageId: string) => void;
  }) => {
    paywallMocks.coinsTab = { selectedPackage, onSelectPackage };
    return React.createElement('section', {
      'data-paywall-coins-tab': true,
      'data-selected-package': selectedPackage,
    });
  },
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
  paywallMocks.coinsTab = null;
  paywallMocks.sessionStorage.clear();
  paywallMocks.subscribeTab = null;
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

  it.each([
    {
      label: 'Subscribe Now',
      checkoutMock: paywallMocks.createSubscriptionCheckout,
      checkoutArgs: ['weekly', '/read/book-paywall-1/7'],
    },
    {
      label: 'Buy Coins Now',
      checkoutMock: paywallMocks.createCoinCheckout,
      checkoutArgs: ['pack_120', '/read/book-paywall-1/7'],
    },
  ])(
    'shows checkout error, leaves $label enabled, and avoids navigation when checkout rejects',
    async ({ checkoutArgs, checkoutMock, label }) => {
      paywallMocks.auth.user = { id: 'user-paywall-1' };
      checkoutMock.mockRejectedValue(new Error('stripe unavailable'));
      renderToStaticMarkup(
        <Paywall chapter={lockedChapter} currentUrl="/read/book-paywall-1/7" onDismiss={vi.fn()} />,
      );

      await clickPaywallButton(label);

      expect(buttonByLabel(label)?.disabled).toBe(false);
      expect(checkoutMock).toHaveBeenCalledWith(...checkoutArgs);
      expect(paywallMocks.toastError).toHaveBeenCalledWith('Checkout could not be started.');
      expect(paywallMocks.locationAssign).not.toHaveBeenCalled();
    },
  );

  it('disables both checkout CTAs and early-returns while auth is loading', async () => {
    paywallMocks.auth.isLoading = true;
    renderToStaticMarkup(
      <Paywall chapter={lockedChapter} currentUrl="/read/book-paywall-1/7" onDismiss={vi.fn()} />,
    );

    expect(buttonByLabel('Subscribe Now')?.disabled).toBe(true);
    expect(buttonByLabel('Buy Coins Now')?.disabled).toBe(true);

    await clickPaywallButton('Subscribe Now');
    await clickPaywallButton('Buy Coins Now');

    expect(paywallMocks.openAuthModal).not.toHaveBeenCalled();
    expect(paywallMocks.createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(paywallMocks.createCoinCheckout).not.toHaveBeenCalled();
    expect(paywallMocks.fbTrackInitiateCheckout).not.toHaveBeenCalled();
    expect(paywallMocks.locationAssign).not.toHaveBeenCalled();
  });

  it('keeps both subscription and coin checkout handoffs available for signed-in users', async () => {
    paywallMocks.auth.user = { id: 'user-paywall-1' };
    paywallMocks.createSubscriptionCheckout.mockResolvedValue({
      url: 'https://checkout.stripe.test/subscription',
      sessionId: 'cs_subscription',
    });
    paywallMocks.createCoinCheckout.mockResolvedValue({
      url: 'https://checkout.stripe.test/coins',
      sessionId: 'cs_coins',
    });
    const html = renderToStaticMarkup(
      <Paywall chapter={lockedChapter} currentUrl="/read/book-paywall-1/7" onDismiss={vi.fn()} />,
    );

    expect(html).toContain('Subscribe');
    expect(html).toContain('Buy Coins');
    expect(buttonByLabel('Subscribe Now')?.onClick).toBeTypeOf('function');
    expect(buttonByLabel('Buy Coins Now')?.onClick).toBeTypeOf('function');

    await clickPaywallButton('Subscribe Now');
    await clickPaywallButton('Buy Coins Now');

    expect(paywallMocks.createSubscriptionCheckout).toHaveBeenCalledWith(
      'weekly',
      '/read/book-paywall-1/7',
    );
    expect(paywallMocks.createCoinCheckout).toHaveBeenCalledWith(
      'pack_120',
      '/read/book-paywall-1/7',
    );
    expect(paywallMocks.openAuthModal).not.toHaveBeenCalled();
    expect(paywallMocks.locationAssign).toHaveBeenCalledWith(
      'https://checkout.stripe.test/subscription',
    );
    expect(paywallMocks.locationAssign).toHaveBeenCalledWith('https://checkout.stripe.test/coins');
  });

  it('preserves deferred subscription return URL when auth succeeds later', async () => {
    paywallMocks.createSubscriptionCheckout.mockResolvedValue({
      url: 'https://checkout.stripe.test/subscription',
      sessionId: 'cs_subscription',
    });
    renderToStaticMarkup(
      <Paywall
        chapter={lockedChapter}
        currentUrl="/read/book-paywall-1/7?source=ad&chapter=7"
        onDismiss={vi.fn()}
      />,
    );

    await clickPaywallButton('Subscribe Now');

    expect(paywallMocks.openAuthModal).toHaveBeenCalledWith({
      mode: 'signin',
      reason: 'paywall',
      afterSuccess: expect.any(Function),
    });
    expect(paywallMocks.createSubscriptionCheckout).not.toHaveBeenCalled();

    const [{ afterSuccess }] = paywallMocks.openAuthModal.mock.calls[0] as [
      { afterSuccess: () => void },
    ];
    afterSuccess();
    await Promise.resolve();

    expect(paywallMocks.sessionStorage.get('novelhub:return-url')).toBe(
      '/read/book-paywall-1/7?source=ad&chapter=7',
    );
    expect(paywallMocks.createSubscriptionCheckout).toHaveBeenCalledWith(
      'weekly',
      '/read/book-paywall-1/7?source=ad&chapter=7',
    );
    expect(paywallMocks.locationAssign).toHaveBeenCalledWith(
      'https://checkout.stripe.test/subscription',
    );
  });
});

function buttonByLabel(
  label: string,
): { label: string; disabled?: boolean; onClick?: () => void | Promise<void> } | undefined {
  return paywallMocks.buttons.find((candidate) => candidate.label === label);
}

async function clickPaywallButton(label: string): Promise<void> {
  const button = paywallMocks.buttons.find((candidate) => candidate.label === label);
  expect(button?.onClick).toBeTypeOf('function');
  await button?.onClick?.();
}
