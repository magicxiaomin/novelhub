import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ toString: () => 'session=abc' })),
  headers: vi.fn(() => ({
    get: (name: string) => (name.toLowerCase() === 'x-request-id' ? 'req_ssr123' : null),
  })),
}));

import {
  buildServerApiUrl,
  fetchBookCategoriesServer,
  fetchBookChaptersServer,
  fetchBookServer,
  fetchBooksServer,
  fetchChapterServer,
} from './server-api';

describe('server API fetch helpers', () => {
  const originalNextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalNextPublicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalApiInternalUrl = process.env.API_INTERNAL_URL;
  const originalNovelhubE2eNovelFixtures = process.env.NOVELHUB_E2E_NOVEL_FIXTURES;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.API_INTERNAL_URL;
    delete process.env.NOVELHUB_E2E_NOVEL_FIXTURES;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalNextPublicApiUrl;
    process.env.NEXT_PUBLIC_API_BASE_URL = originalNextPublicApiBaseUrl;
    process.env.API_INTERNAL_URL = originalApiInternalUrl;
    process.env.NOVELHUB_E2E_NOVEL_FIXTURES = originalNovelhubE2eNovelFixtures;
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('prefers the canonical public API base URL when configured', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.novelhub.test';

    expect(buildServerApiUrl('/books/1', { page: 2, skip: undefined })).toBe(
      'https://api.novelhub.test/books/1?page=2',
    );
  });

  it('uses the legacy public absolute API URL when the canonical name is unset', () => {
    expect(buildServerApiUrl('/books/1', { page: 2, skip: undefined })).toBe(
      'http://api.test/books/1?page=2',
    );
  });

  it('resolves same-origin public proxy paths to the default internal API URL', async () => {
    process.env.NEXT_PUBLIC_API_URL = '/api-proxy';
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: '22222222-2222-4222-8222-222222222222' }),
      };
    }) as unknown as typeof fetch;

    await fetchBookServer('22222222-2222-4222-8222-222222222222');

    expect(calls[0]).toBe('http://localhost:4000/books/22222222-2222-4222-8222-222222222222');
  });

  it('allows overriding the internal API URL for SSR fetches', () => {
    process.env.NEXT_PUBLIC_API_URL = '/api-proxy';
    process.env.API_INTERNAL_URL = 'http://api.internal:4000';

    expect(buildServerApiUrl('/books/featured', { limit: 10 })).toBe(
      'http://api.internal:4000/books/featured?limit=10',
    );
  });

  it('forwards incoming x-request-id on server read-path fetches with existing cookies', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [], page: 1, limit: 200, total: 0, totalPages: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    await fetchBookServer('book-1');
    await fetchBooksServer();
    await fetchBookCategoriesServer();
    await fetchBookChaptersServer('book-1');
    await fetchChapterServer('chapter-1');

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(calls).toHaveLength(5);
    for (const [, init] of calls) {
      expect(init?.headers).toMatchObject({ cookie: 'session=abc', 'x-request-id': 'req_ssr123' });
    }
  });

  it.each([401, 404])('returns null when fetchBookServer receives %s', async (status) => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;

    await expect(fetchBookServer('book-missing')).resolves.toBeNull();
  });

  it('throws when fetchBookServer receives a server error', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(fetchBookServer('book-500')).rejects.toThrow('Failed to fetch book book-500: 500');
  });

  it('parses BookDetail when fetchBookServer receives a successful response', async () => {
    const detail = {
      id: 'book-ok',
      title: 'Server Contract',
      author: 'NovelHub',
      coverUrl: '/cover.png',
      category: 'Fantasy',
      tags: [],
      status: 'ongoing',
      isFeatured: false,
      totalChapters: 12,
      freeChapterCount: 3,
      coinPerChapter: 10,
      description: 'Fetched detail.',
      chapters: [],
    };
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(detail), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(fetchBookServer(detail.id)).resolves.toEqual(detail);
  });

  it('fetches book chapters server-side with no-store cache and forwarded read headers', async () => {
    const chapters = {
      items: [
        {
          id: 'chapter-1',
          bookId: 'book/with spaces',
          order: 1,
          title: 'Contract Chapter',
          isFree: true,
          wordCount: 1000,
        },
      ],
      total: 1,
      page: 4,
      limit: 20,
    };
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(chapters), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(fetchBookChaptersServer('book/with spaces', 4, 20)).resolves.toEqual(chapters);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/books/book%2Fwith%20spaces/chapters?page=4&limit=20',
      {
        cache: 'no-store',
        headers: { cookie: 'session=abc', 'x-request-id': 'req_ssr123' },
      },
    );
  });

  it('defaults server-side book chapters fetches to page 1 and limit 200', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [], total: 0, page: 1, limit: 200 }), { status: 200 }),
    ) as unknown as typeof fetch;

    await fetchBookChaptersServer('book-1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/books/book-1/chapters?page=1&limit=200',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it.each([401, 404])('returns null when fetchBookChaptersServer receives %s', async (status) => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;

    await expect(fetchBookChaptersServer('book-missing')).resolves.toBeNull();
  });

  it('throws when fetchBookChaptersServer receives a server error', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(fetchBookChaptersServer('book-500')).rejects.toThrow(
      'Failed to fetch chapters for book book-500: 500',
    );
  });
});
