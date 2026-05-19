import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PaymentSuccessPage from './page';
import { PaymentSuccessClient } from '@/components/paywall/payment-success-client';
import { fetchPaymentOrder } from '@/lib/queries';
import { fbTrackPurchase } from '@/lib/fb-pixel';
import { getPaymentSuccessState } from '@/lib/payment-success';

const { searchParams, push, messages } = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  messages: {
    payment: {
      confirming: 'Confirming payment',
      completed: 'Payment complete',
      failed: 'Payment failed',
      missingSession: 'Missing payment session',
      retry: 'Retry payment status',
      home: 'Back home',
      library: 'Go to library',
    },
  } as const,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    asChild,
    children,
    className,
    type,
    variant,
  }: {
    asChild?: boolean;
    children: React.ReactNode;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    variant?: string;
  }) => {
    if (
      asChild &&
      React.isValidElement<{ className?: string; 'data-variant'?: string }>(children)
    ) {
      return React.cloneElement(children, {
        className,
        'data-variant': variant,
      });
    }
    return React.createElement('button', { className, type, 'data-variant': variant }, children);
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-payment-skeleton': true, className }),
}));

vi.mock('@/lib/queries', () => ({
  fetchPaymentOrder: vi.fn(),
}));

vi.mock('@/lib/fb-pixel', () => ({
  fbTrackPurchase: vi.fn(),
}));

vi.mock('@/lib/payment-success', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payment-success')>();
  return {
    ...actual,
    getPaymentSuccessState: vi.fn(actual.getPaymentSuccessState),
  };
});

vi.mock('@novelhub/shared', () => ({
  messages,
}));

const mockedGetPaymentSuccessState = vi.mocked(getPaymentSuccessState);
const mockedFetchPaymentOrder = vi.mocked(fetchPaymentOrder);
const mockedFbTrackPurchase = vi.mocked(fbTrackPurchase);

function renderClientWithSession(state: 'confirming' | 'completed' | 'failed'): string {
  searchParams.set('session_id', 'cs_test_static');
  mockedGetPaymentSuccessState.mockReturnValue(state);

  return renderToStaticMarkup(<PaymentSuccessClient />);
}

beforeEach(() => {
  vi.stubGlobal('React', React);
  searchParams.delete('session_id');
  searchParams.delete('return_url');
  push.mockReset();
  mockedFetchPaymentOrder.mockReset();
  mockedFbTrackPurchase.mockReset();
  mockedGetPaymentSuccessState.mockReset();
});

describe('payment success static render', () => {
  it('renders the page shell with the confirming state inside the mobile container', () => {
    searchParams.set('session_id', 'cs_test_static');
    mockedGetPaymentSuccessState.mockReturnValue('confirming');

    const html = renderToStaticMarkup(<PaymentSuccessPage />);

    expect(html).toContain('max-w-mobile');
    expect(html).toContain(messages.payment.confirming);
    expect(html).not.toContain(messages.payment.completed);
    expect(html).not.toContain(messages.payment.failed);
    expect(mockedFetchPaymentOrder).not.toHaveBeenCalled();
    expect(mockedFbTrackPurchase).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps the Suspense fallback deterministic for static rendering', () => {
    const html = renderToStaticMarkup(
      <React.Suspense fallback={<PaymentSuccessFallbackProbe />}>
        <NeverResolves />
      </React.Suspense>,
    );

    expect(html).toContain(messages.payment.confirming);
    expect(html).toContain('max-w-mobile');
    expect(html.match(/data-payment-skeleton="true"/g)).toHaveLength(2);
    expect(html).toContain('h-7 w-40');
    expect(html).toContain('h-4 w-52');
  });

  it('renders missing session copy and home CTA without polling or telemetry', () => {
    const html = renderToStaticMarkup(<PaymentSuccessClient />);

    expect(html).toContain(messages.payment.missingSession);
    expect(html).toContain(`href="/"`);
    expect(html).toContain(messages.payment.home);
    expect(html).not.toContain(messages.payment.retry);
    expect(html).not.toContain(messages.payment.library);
    expect(mockedGetPaymentSuccessState).not.toHaveBeenCalled();
    expect(mockedFetchPaymentOrder).not.toHaveBeenCalled();
    expect(mockedFbTrackPurchase).not.toHaveBeenCalled();
  });

  it('renders confirming copy without completed or failed CTAs', () => {
    const html = renderClientWithSession('confirming');

    expect(html).toContain(messages.payment.confirming);
    expect(html).not.toContain(messages.payment.library);
    expect(html).not.toContain(messages.payment.retry);
    expect(html).not.toContain(messages.payment.home);
    expect(mockedFetchPaymentOrder).not.toHaveBeenCalled();
    expect(mockedFbTrackPurchase).not.toHaveBeenCalled();
  });

  it('renders completed copy and library CTA without retry CTA', () => {
    const html = renderClientWithSession('completed');

    expect(html).toContain(messages.payment.completed);
    expect(html).toContain(`href="/library"`);
    expect(html).toContain(messages.payment.library);
    expect(html).not.toContain(messages.payment.retry);
    expect(mockedFetchPaymentOrder).not.toHaveBeenCalled();
    expect(mockedFbTrackPurchase).not.toHaveBeenCalled();
  });

  it('renders failed copy, retry CTA, and home fallback CTA', () => {
    const html = renderClientWithSession('failed');

    expect(html).toContain(messages.payment.failed);
    expect(html).toContain(messages.payment.retry);
    expect(html).toContain(`href="/"`);
    expect(html).toContain(messages.payment.home);
    expect(html).not.toContain(messages.payment.library);
    expect(mockedFetchPaymentOrder).not.toHaveBeenCalled();
    expect(mockedFbTrackPurchase).not.toHaveBeenCalled();
  });
});

function NeverResolves(): JSX.Element {
  throw new Promise(() => undefined);
}

function PaymentSuccessFallbackProbe(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile flex-col items-center justify-center px-6 text-center">
      <div aria-label={messages.payment.confirming} className="w-full max-w-56 space-y-4">
        <div data-payment-skeleton="true" className="mx-auto h-7 w-40" />
        <div data-payment-skeleton="true" className="mx-auto h-4 w-52" />
      </div>
    </main>
  );
}
