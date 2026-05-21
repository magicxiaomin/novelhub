/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COIN_PACKAGES, messages, SUBSCRIPTION_PLANS } from '@novelhub/shared';

type RechargeUser = {
  id: string;
  coinBalance: number;
};

const rechargeMocks = vi.hoisted(() => ({
  auth: {
    user: null as RechargeUser | null,
    isLoading: false,
  },
  coinTransactions: vi.fn(),
  openAuthModal: vi.fn(),
  replace: vi.fn(),
  searchTab: null as string | null,
  toastError: vi.fn(),
  fbTrackAddToCart: vi.fn(),
  fbTrackInitiateCheckout: vi.fn(),
  locationAssign: vi.fn(),
  createCoinCheckout: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  coinsTab: null as null | { selectedPackage: string },
  subscribeTab: null as null | { selectedPlan: string },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: rechargeMocks.replace }),
  useSearchParams: () =>
    new URLSearchParams(rechargeMocks.searchTab ? { tab: rechargeMocks.searchTab } : {}),
}));

vi.mock('sonner', () => ({
  toast: { error: rechargeMocks.toastError },
}));

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="app-shell">{children}</main>
  ),
}));

vi.mock('@/components/providers', () => ({
  useAuth: () => ({
    user: rechargeMocks.auth.user,
    isLoading: rechargeMocks.auth.isLoading,
    openAuthModal: rechargeMocks.openAuthModal,
  }),
}));

vi.mock('@/components/paywall/coins-tab', () => ({
  CoinsTab: ({
    selectedPackage,
    onSelectPackage,
  }: {
    selectedPackage: string;
    onSelectPackage: (packageId: string) => void;
  }) => {
    rechargeMocks.coinsTab = { selectedPackage };
    return (
      <section data-testid="coins-tab" data-selected-package={selectedPackage}>
        <button type="button" onClick={() => onSelectPackage('pack_700')}>
          select pack 700
        </button>
      </section>
    );
  },
}));

vi.mock('@/components/paywall/subscribe-tab', () => ({
  SubscribeTab: ({
    selectedPlan,
    onSelectPlan,
  }: {
    selectedPlan: string;
    onSelectPlan: (plan: string) => void;
  }) => {
    rechargeMocks.subscribeTab = { selectedPlan };
    return (
      <section data-testid="subscribe-tab" data-selected-plan={selectedPlan}>
        <button type="button" onClick={() => onSelectPlan('monthly')}>
          select monthly
        </button>
      </section>
    );
  },
}));

vi.mock('@/lib/queries', () => ({
  createCoinCheckout: rechargeMocks.createCoinCheckout,
  createSubscriptionCheckout: rechargeMocks.createSubscriptionCheckout,
  fetchCoinTransactions: rechargeMocks.coinTransactions,
  queryKeys: {
    coinTransactions: (page: number, limit: number) => ['coinTransactions', page, limit],
  },
}));

vi.mock('@/lib/fb-pixel', () => ({
  fbTrackAddToCart: rechargeMocks.fbTrackAddToCart,
  fbTrackInitiateCheckout: rechargeMocks.fbTrackInitiateCheckout,
}));

vi.mock('@/lib/formatters', () => ({
  formatRelativeTimestamp: () => 'just now',
  formatTransactionAmount: (amount: number) => String(amount),
  getTransactionAmountClass: () => 'amount-class',
}));

vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' '),
}));

import { RechargeClient } from './recharge-client';

function renderRechargeClient(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RechargeClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rechargeMocks.auth.user = null;
  rechargeMocks.auth.isLoading = false;
  rechargeMocks.searchTab = null;
  rechargeMocks.coinsTab = null;
  rechargeMocks.subscribeTab = null;
  rechargeMocks.coinTransactions.mockResolvedValue({ items: [] });
  rechargeMocks.createCoinCheckout.mockResolvedValue({
    url: 'https://checkout.stripe.test/coins',
    sessionId: 'cs_coin_default',
  });
  rechargeMocks.createSubscriptionCheckout.mockResolvedValue({
    url: 'https://checkout.stripe.test/subscription',
    sessionId: 'cs_subscription_default',
  });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: rechargeMocks.locationAssign },
  });
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Reflect.deleteProperty(globalThis, 'React');
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

describe('RechargeClient auth/loading/header states', () => {
  it('renders the skeleton fallback while auth is loading without opening auth', () => {
    rechargeMocks.auth.isLoading = true;

    renderRechargeClient();

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(document.querySelectorAll('.h-16.rounded-lg')).toHaveLength(1);
    expect(document.querySelectorAll('.h-64.rounded-lg')).toHaveLength(1);
    expect(
      screen.queryByRole('heading', { name: messages.recharge.title }),
    ).not.toBeInTheDocument();
    expect(rechargeMocks.openAuthModal).not.toHaveBeenCalled();
    expect(rechargeMocks.coinTransactions).not.toHaveBeenCalled();
  });

  it('renders the same skeleton fallback for unauthenticated users and opens sign-in auth', async () => {
    renderRechargeClient();

    expect(document.querySelectorAll('.h-16.rounded-lg')).toHaveLength(1);
    expect(document.querySelectorAll('.h-64.rounded-lg')).toHaveLength(1);
    expect(screen.queryByTestId('coins-tab')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(rechargeMocks.openAuthModal).toHaveBeenCalledWith({ mode: 'signin' }),
    );
    expect(rechargeMocks.coinTransactions).not.toHaveBeenCalled();
  });

  it('renders the authenticated recharge header, balance, default coins tab, and transaction state', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-1', coinBalance: 420 };

    renderRechargeClient();

    expect(screen.getByRole('heading', { name: messages.recharge.title })).toBeInTheDocument();
    expect(
      screen.getByText(messages.recharge.balance.replace('{balance}', '420')),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: messages.recharge.buyCoins })[0]).toHaveClass(
      'bg-background',
    );
    expect(screen.getByTestId('coins-tab')).toHaveAttribute('data-selected-package', 'pack_120');
    expect(screen.queryByTestId('subscribe-tab')).not.toBeInTheDocument();
    expect(rechargeMocks.openAuthModal).not.toHaveBeenCalled();
    await waitFor(() => expect(rechargeMocks.coinTransactions).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(messages.recharge.emptyTransactions)).toBeInTheDocument();
  });

  it('uses the subscribe tab from the tab search param for authenticated users', () => {
    rechargeMocks.auth.user = { id: 'user-recharge-2', coinBalance: 7 };
    rechargeMocks.searchTab = 'subscribe';

    renderRechargeClient();

    expect(screen.getByRole('button', { name: messages.recharge.subscribe })).toHaveClass(
      'bg-background',
    );
    expect(screen.getByTestId('subscribe-tab')).toHaveAttribute('data-selected-plan', 'weekly');
    expect(screen.queryByTestId('coins-tab')).not.toBeInTheDocument();
  });

  it('switches tabs from the local controls and updates the recharge URL', () => {
    rechargeMocks.auth.user = { id: 'user-recharge-3', coinBalance: 12 };

    renderRechargeClient();

    fireEvent.click(screen.getByRole('button', { name: messages.recharge.subscribe }));

    expect(rechargeMocks.replace).toHaveBeenCalledWith('/recharge?tab=subscribe');
    expect(screen.getByTestId('subscribe-tab')).toHaveAttribute('data-selected-plan', 'weekly');
    expect(screen.queryByTestId('coins-tab')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: messages.recharge.buyCoins }));

    expect(rechargeMocks.replace).toHaveBeenCalledWith('/recharge');
    expect(screen.getByTestId('coins-tab')).toHaveAttribute('data-selected-package', 'pack_120');
    expect(screen.queryByTestId('subscribe-tab')).not.toBeInTheDocument();
  });

  it('wires mocked child package selection into coin tracking and checkout redirect', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-4', coinBalance: 12 };

    renderRechargeClient();
    fireEvent.click(screen.getByRole('button', { name: 'select pack 700' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: messages.recharge.buyCoinsNow }).at(-1) as HTMLElement,
    );

    expect(screen.getByTestId('coins-tab')).toHaveAttribute('data-selected-package', 'pack_700');
    expect(rechargeMocks.fbTrackAddToCart).toHaveBeenCalledWith({
      value: COIN_PACKAGES.pack_700.priceUsd,
      currency: 'USD',
      contentIds: ['pack_700'],
    });
    expect(rechargeMocks.fbTrackInitiateCheckout).toHaveBeenCalledWith({
      value: COIN_PACKAGES.pack_700.priceUsd,
      currency: 'USD',
    });
    await waitFor(() => expect(rechargeMocks.createCoinCheckout).toHaveBeenCalledWith('pack_700'));
    await waitFor(() =>
      expect(rechargeMocks.locationAssign).toHaveBeenCalledWith(
        'https://checkout.stripe.test/coins',
      ),
    );
  });

  it('wires mocked child plan selection into subscription tracking and checkout redirect', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-5', coinBalance: 12 };
    rechargeMocks.searchTab = 'subscribe';

    renderRechargeClient();
    fireEvent.click(screen.getByRole('button', { name: 'select monthly' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: messages.recharge.subscribeNow }).at(-1) as HTMLElement,
    );

    expect(screen.getByTestId('subscribe-tab')).toHaveAttribute('data-selected-plan', 'monthly');
    expect(rechargeMocks.fbTrackAddToCart).toHaveBeenCalledWith({
      value: SUBSCRIPTION_PLANS.monthly.priceUsd,
      currency: 'USD',
      contentIds: ['monthly'],
    });
    expect(rechargeMocks.fbTrackInitiateCheckout).toHaveBeenCalledWith({
      value: SUBSCRIPTION_PLANS.monthly.priceUsd,
      currency: 'USD',
    });
    await waitFor(() =>
      expect(rechargeMocks.createSubscriptionCheckout).toHaveBeenCalledWith('monthly'),
    );
    await waitFor(() =>
      expect(rechargeMocks.locationAssign).toHaveBeenCalledWith(
        'https://checkout.stripe.test/subscription',
      ),
    );
  });

  it('disables coin checkout while the mocked checkout mutation is pending', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-6', coinBalance: 12 };
    rechargeMocks.createCoinCheckout.mockReturnValue(new Promise(() => undefined));

    renderRechargeClient();
    fireEvent.click(
      screen.getAllByRole('button', { name: messages.recharge.buyCoinsNow }).at(-1) as HTMLElement,
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: messages.recharge.buyCoinsNow }).at(-1),
      ).toBeDisabled(),
    );
    expect(rechargeMocks.createCoinCheckout).toHaveBeenCalledWith('pack_120');
  });

  it('disables subscription checkout while the mocked checkout mutation is pending', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-7', coinBalance: 12 };
    rechargeMocks.searchTab = 'subscribe';
    rechargeMocks.createSubscriptionCheckout.mockReturnValue(new Promise(() => undefined));

    renderRechargeClient();
    fireEvent.click(
      screen.getAllByRole('button', { name: messages.recharge.subscribeNow }).at(-1) as HTMLElement,
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: messages.recharge.subscribeNow }).at(-1),
      ).toBeDisabled(),
    );
    expect(rechargeMocks.createSubscriptionCheckout).toHaveBeenCalledWith('weekly');
  });

  it('shows the checkout error toast when coin checkout fails', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-8', coinBalance: 12 };
    rechargeMocks.createCoinCheckout.mockRejectedValue(new Error('checkout failed'));

    renderRechargeClient();
    fireEvent.click(
      screen.getAllByRole('button', { name: messages.recharge.buyCoinsNow }).at(-1) as HTMLElement,
    );

    await waitFor(() =>
      expect(rechargeMocks.toastError).toHaveBeenCalledWith(messages.recharge.checkoutError),
    );
    expect(rechargeMocks.locationAssign).not.toHaveBeenCalled();
  });

  it('shows the checkout error toast when subscription checkout fails', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-9', coinBalance: 12 };
    rechargeMocks.searchTab = 'subscribe';
    rechargeMocks.createSubscriptionCheckout.mockRejectedValue(new Error('checkout failed'));

    renderRechargeClient();
    fireEvent.click(
      screen.getAllByRole('button', { name: messages.recharge.subscribeNow }).at(-1) as HTMLElement,
    );

    await waitFor(() =>
      expect(rechargeMocks.toastError).toHaveBeenCalledWith(messages.recharge.checkoutError),
    );
    expect(rechargeMocks.locationAssign).not.toHaveBeenCalled();
  });
});

describe('RechargeClient transaction states', () => {
  it('renders transaction skeleton rows while local mocked transactions are loading', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-transactions-loading', coinBalance: 12 };
    rechargeMocks.coinTransactions.mockReturnValue(new Promise(() => undefined));

    renderRechargeClient();

    await waitFor(() => expect(rechargeMocks.coinTransactions).toHaveBeenCalledWith(1, 20));
    expect(document.querySelectorAll('.animate-pulse.h-12.rounded-md')).toHaveLength(3);
    expect(screen.queryByText(messages.recharge.emptyTransactions)).not.toBeInTheDocument();
  });

  it('renders populated local mocked coin transactions with labels and formatted amounts', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-transactions-populated', coinBalance: 42 };
    rechargeMocks.coinTransactions.mockResolvedValue({
      items: [
        {
          id: 'txn-purchase-1',
          amount: 120,
          type: 'COIN_PURCHASE',
          relatedId: 'payment-1',
          balanceAfter: 162,
          createdAt: '2026-05-21T12:00:00.000Z',
        },
        {
          id: 'txn-unlock-1',
          amount: -12,
          type: 'CHAPTER_UNLOCK',
          relatedId: 'chapter-1',
          balanceAfter: 150,
          createdAt: '2026-05-21T12:05:00.000Z',
        },
      ],
    });

    renderRechargeClient();

    await waitFor(() => expect(rechargeMocks.coinTransactions).toHaveBeenCalledWith(1, 20));
    expect(await screen.findByText(messages.recharge.type_COIN_PURCHASE)).toBeInTheDocument();
    expect(screen.getByText(messages.recharge.type_CHAPTER_UNLOCK)).toBeInTheDocument();
    expect(screen.getByText('120')).toHaveClass('amount-class');
    expect(screen.getByText('-12')).toHaveClass('amount-class');
    expect(screen.getAllByText('just now')).toHaveLength(2);
    expect(screen.queryByText(messages.recharge.emptyTransactions)).not.toBeInTheDocument();
  });

  it('renders the empty transaction state after the local mocked transactions resolve empty', async () => {
    rechargeMocks.auth.user = { id: 'user-recharge-transactions-empty', coinBalance: 0 };
    rechargeMocks.coinTransactions.mockResolvedValue({ items: [] });

    renderRechargeClient();

    await waitFor(() => expect(rechargeMocks.coinTransactions).toHaveBeenCalledWith(1, 20));
    expect(await screen.findByText(messages.recharge.emptyTransactions)).toBeInTheDocument();
    expect(screen.queryByText(messages.recharge.type_COIN_PURCHASE)).not.toBeInTheDocument();
  });
});
