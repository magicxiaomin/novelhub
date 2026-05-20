import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCoinCheckout,
  createSubscriptionCheckout,
  fetchBookChapters,
  fetchPaymentOrder,
  fetchUnlocks,
  queryKeys,
} from './queries';
import type { ChapterSummary, Paginated } from './types';

describe('public reading query helpers', () => {
  const realFetch = globalThis.fetch;
  const originalNextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalNextPublicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalNextPublicApiUrl;
    process.env.NEXT_PUBLIC_API_BASE_URL = originalNextPublicApiBaseUrl;
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  const mockJsonResponse = (body: unknown) => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    })) as unknown as typeof fetch;
  };

  it('fetches book chapters with page and limit query parameters', async () => {
    const chapters: Paginated<ChapterSummary> = {
      items: [
        {
          id: 'chapter-1',
          bookId: 'book-1',
          order: 1,
          title: 'The Door Opens',
          isFree: true,
          wordCount: 1200,
        },
      ],
      total: 1,
      page: 2,
      limit: 25,
    };
    mockJsonResponse(chapters);

    await expect(fetchBookChapters('book-1', 2, 25)).resolves.toEqual(chapters);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/books/book-1/chapters?page=2&limit=25',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('percent-encodes book IDs when fetching chapters', async () => {
    mockJsonResponse({ items: [], total: 0, page: 1, limit: 10 });

    await fetchBookChapters('book/with spaces?and=query', 1, 10);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/books/book%2Fwith%20spaces%3Fand%3Dquery/chapters?page=1&limit=10',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('uses a stable book chapters query key shape', () => {
    expect(queryKeys.bookChapters('book-1', 3, 50)).toEqual(['books', 'chapters', 'book-1', 3, 50]);
  });

  it('creates coin checkout sessions without a return URL', async () => {
    const checkout = { url: 'https://stripe.test/coin-session' };
    mockJsonResponse(checkout);

    await expect(createCoinCheckout('coins-100')).resolves.toEqual(checkout);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/payments/checkout/coins',
      expect.objectContaining({
        body: JSON.stringify({ packageId: 'coins-100' }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });

  it('creates coin checkout sessions with a return URL', async () => {
    const checkout = { url: 'https://stripe.test/coin-return-session' };
    mockJsonResponse(checkout);

    await expect(createCoinCheckout('coins-500', '/read/book-1/4?from=paywall')).resolves.toEqual(
      checkout,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/payments/checkout/coins',
      expect.objectContaining({
        body: JSON.stringify({ packageId: 'coins-500', returnUrl: '/read/book-1/4?from=paywall' }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });

  it('creates subscription checkout sessions without a return URL', async () => {
    const checkout = { url: 'https://stripe.test/subscription-session' };
    mockJsonResponse(checkout);

    await expect(createSubscriptionCheckout('weekly')).resolves.toEqual(checkout);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/payments/checkout/subscription',
      expect.objectContaining({
        body: JSON.stringify({ plan: 'weekly' }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });

  it('creates subscription checkout sessions with a return URL', async () => {
    const checkout = { url: 'https://stripe.test/subscription-return-session' };
    mockJsonResponse(checkout);

    await expect(createSubscriptionCheckout('monthly', '/read/book-2/9')).resolves.toEqual(
      checkout,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/payments/checkout/subscription',
      expect.objectContaining({
        body: JSON.stringify({ plan: 'monthly', returnUrl: '/read/book-2/9' }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });

  it('fetches unlocks without a book ID filter', async () => {
    const unlocks = { items: [], total: 0, page: 1, limit: 20 };
    mockJsonResponse(unlocks);

    await expect(fetchUnlocks(1, 20)).resolves.toEqual(unlocks);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/unlocks?page=1&limit=20',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('fetches unlocks with a book ID filter', async () => {
    const unlocks = { items: [], total: 0, page: 2, limit: 10 };
    mockJsonResponse(unlocks);

    await expect(fetchUnlocks(2, 10, 'book/with spaces')).resolves.toEqual(unlocks);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/unlocks?page=2&limit=10&bookId=book%2Fwith+spaces',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('percent-encodes payment order session IDs', async () => {
    const order = { id: 'order-1', status: 'paid' };
    mockJsonResponse(order);

    await expect(fetchPaymentOrder('cs_test/a b?x=1')).resolves.toEqual(order);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/payments/orders/cs_test%2Fa%20b%3Fx%3D1',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('uses stable payment and unlock query key shapes', () => {
    expect(queryKeys.unlocks(1, 20)).toEqual(['unlocks', 1, 20]);
    expect(queryKeys.unlocks(2, 10, 'book-1')).toEqual(['unlocks', 2, 10, 'book-1']);
    expect(queryKeys.order('cs_test_123')).toEqual(['payments', 'orders', 'cs_test_123']);
    expect(queryKeys.subscription).toEqual(['payments', 'subscription']);
  });
});
