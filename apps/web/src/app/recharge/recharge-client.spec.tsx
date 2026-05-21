/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@novelhub/shared';

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
  CoinsTab: ({ selectedPackage }: { selectedPackage: string }) => {
    rechargeMocks.coinsTab = { selectedPackage };
    return <section data-testid="coins-tab" data-selected-package={selectedPackage} />;
  },
}));

vi.mock('@/components/paywall/subscribe-tab', () => ({
  SubscribeTab: ({ selectedPlan }: { selectedPlan: string }) => {
    rechargeMocks.subscribeTab = { selectedPlan };
    return <section data-testid="subscribe-tab" data-selected-plan={selectedPlan} />;
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
});
