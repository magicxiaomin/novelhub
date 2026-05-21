/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@novelhub/shared';
import type { AuthUser, ReadingProgressEntry, SubscriptionSummary } from '@/lib/types';

const meMocks = vi.hoisted(() => ({
  auth: {
    user: null as AuthUser | null,
    isLoading: false,
  },
  openAuthModal: vi.fn(),
  refetch: vi.fn(),
  push: vi.fn(),
  fetchReadingProgress: vi.fn(),
  fetchSubscription: vi.fn(),
  fetchPortal: vi.fn(),
  logout: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: meMocks.push }),
}));

vi.mock('next/image', () => ({
  default: ({ alt, src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ''} src={String(src)} {...props} />
  ),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(meMocks.toast, { error: meMocks.toast }),
}));

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="app-shell">{children}</main>
  ),
}));

vi.mock('@/components/account/delete-account-dialog', () => ({
  DeleteAccountDialog: ({ open }: { open: boolean }) => (
    <div data-testid="delete-account-dialog" data-open={String(open)} />
  ),
}));

vi.mock('@/components/providers', () => ({
  useAuth: () => ({
    user: meMocks.auth.user,
    isLoading: meMocks.auth.isLoading,
    openAuthModal: meMocks.openAuthModal,
    refetch: meMocks.refetch,
  }),
}));

vi.mock('@/lib/queries', () => ({
  fetchPortal: meMocks.fetchPortal,
  fetchReadingProgress: meMocks.fetchReadingProgress,
  fetchSubscription: meMocks.fetchSubscription,
  logout: meMocks.logout,
  queryKeys: {
    subscription: ['subscription'],
    readingProgress: ['readingProgress'],
  },
}));

import { MeClient } from './me-client';

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-me-1',
  email: 'reader@example.com',
  coinBalance: 17,
  hasPassword: true,
  hasActiveSubscription: false,
  isAdmin: false,
  bannedAt: null,
  ...overrides,
});

const progressEntry = (overrides: Partial<ReadingProgressEntry> = {}): ReadingProgressEntry => ({
  bookId: 'book with spaces',
  chapterId: 'chapter-uuid',
  chapterNumber: 7,
  scrollPercent: 42,
  bookTitle: 'The Last Ember',
  bookCover: '/covers/ember.svg',
  updatedAt: '2026-05-17T00:00:00.000Z',
  ...overrides,
});

const subscription = (overrides: Partial<SubscriptionSummary> = {}): SubscriptionSummary => ({
  plan: 'monthly',
  status: 'active',
  currentPeriodEnd: '2026-06-20T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  canceledAt: null,
  ...overrides,
});

function renderMeClient(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MeClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  meMocks.auth.user = null;
  meMocks.auth.isLoading = false;
  meMocks.fetchReadingProgress.mockResolvedValue([]);
  meMocks.fetchSubscription.mockResolvedValue(subscription());
  meMocks.fetchPortal.mockResolvedValue({ url: 'https://billing.stripe.test/session' });
  meMocks.logout.mockResolvedValue(undefined);
  meMocks.refetch.mockResolvedValue(undefined);
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

describe('MeClient entitlement reflection characterization', () => {
  it('renders the unauthenticated skeleton and opens sign-in without fetching entitlement data', async () => {
    renderMeClient();

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: messages.account.title })).not.toBeInTheDocument();
    await waitFor(() => expect(meMocks.openAuthModal).toHaveBeenCalledWith({ mode: 'signin' }));
    expect(meMocks.fetchReadingProgress).not.toHaveBeenCalled();
    expect(meMocks.fetchSubscription).not.toHaveBeenCalled();
  });

  it('reflects an active subscription with account summary while preserving reading progress recovery', async () => {
    meMocks.auth.user = user({ hasActiveSubscription: true });
    meMocks.fetchReadingProgress.mockResolvedValue([progressEntry()]);
    meMocks.fetchSubscription.mockResolvedValue(subscription({ plan: 'weekly' }));

    renderMeClient();

    expect(screen.getByRole('heading', { name: messages.account.title })).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(await screen.findByText('Weekly')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.account.manageSubscription }),
    ).toBeInTheDocument();
    expect(screen.getByText('The Last Ember')).toBeInTheDocument();
    expect(screen.getByText('Continue reading The Last Ember · Ch 7')).toBeInTheDocument();
    expect(screen.getAllByText('Chapter 7 · 42%')).toHaveLength(2);
    expect(
      screen.getAllByRole('link', { name: /The Last Ember|Continue reading The Last Ember/ }),
    ).toHaveLength(2);
    expect(meMocks.fetchSubscription).toHaveBeenCalledTimes(1);
  });

  it('reflects no active subscription with subscribe CTA and empty reading progress state', async () => {
    meMocks.auth.user = user({ hasActiveSubscription: false, coinBalance: 0 });
    meMocks.fetchReadingProgress.mockResolvedValue([]);

    renderMeClient();

    expect(screen.getByRole('heading', { name: messages.account.title })).toBeInTheDocument();
    expect(await screen.findByText(messages.account.emptyHistory)).toBeInTheDocument();
    expect(screen.getByText(messages.account.subscribePrompt)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.account.subscribeCta })).toHaveAttribute(
      'href',
      '/recharge?tab=subscribe',
    );
    expect(screen.queryByText(/^Continue reading /)).not.toBeInTheDocument();
    expect(meMocks.fetchSubscription).not.toHaveBeenCalled();
  });

  it('reflects individual-unlock recovery only through existing reading-progress rows without new library state', async () => {
    meMocks.auth.user = user({ hasActiveSubscription: false, coinBalance: 3 });
    meMocks.fetchReadingProgress.mockResolvedValue([
      progressEntry({
        bookId: 'individually-unlocked-book',
        chapterId: 'individual-unlock-chapter',
        chapterNumber: 12,
        bookTitle: 'Unlocked By Coins',
        scrollPercent: 88.4,
      }),
    ]);

    renderMeClient();

    expect(
      await screen.findByText('Continue reading Unlocked By Coins · Ch 12'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unlocked By Coins')).toBeInTheDocument();
    expect(screen.getAllByText('Chapter 12 · 88%')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /Unlocked By Coins/ })).toHaveLength(2);
    expect(screen.getByText(messages.account.subscribePrompt)).toBeInTheDocument();
    expect(screen.queryByText(/library/i)).not.toBeInTheDocument();
    expect(meMocks.fetchSubscription).not.toHaveBeenCalled();
  });
});
