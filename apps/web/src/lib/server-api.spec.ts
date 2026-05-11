import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildServerApiUrl, fetchBookServer } from './server-api';

describe('server API fetch helpers', () => {
  const originalNextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalNextPublicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalApiInternalUrl = process.env.API_INTERNAL_URL;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.API_INTERNAL_URL;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalNextPublicApiUrl;
    process.env.NEXT_PUBLIC_API_BASE_URL = originalNextPublicApiBaseUrl;
    process.env.API_INTERNAL_URL = originalApiInternalUrl;
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('prefers the canonical public API base URL when configured', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.dramavela.com';

    expect(buildServerApiUrl('/books/1', { page: 2, skip: undefined })).toBe(
      'https://api.dramavela.com/books/1?page=2',
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

  it('fetches drama detail by slug from the public drama endpoint', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.dramavela.com';
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: 'drama-1',
        slug: 'hidden-love',
        title: 'Hidden Love',
        description: 'A short drama.',
        posterUrl: 'https://cdn.example.com/poster.jpg',
        category: 'Romance',
        tags: ['sweet'],
        totalEpisodes: 24,
        status: 'ONGOING',
        isFeatured: true,
        sortOrder: 1,
        freeEpisodeCount: 3,
        coinPerEpisode: 8,
        publishedAt: null,
        episodes: [],
      }),
    );
    globalThis.fetch = fetchMock;

    const { fetchDramaServer } = await import('./server-api');
    const drama = await fetchDramaServer('hidden-love');

    expect(fetchMock).toHaveBeenCalledWith('https://api.dramavela.com/dramas/hidden-love', {
      cache: 'no-store',
      headers: { cookie: '' },
    });
    expect(drama?.title).toBe('Hidden Love');
  });

  it('fetches featured dramas with pagination query params', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.dramavela.com';
    const fetchMock = vi.fn(async () =>
      Response.json({
        items: [],
        pageInfo: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      }),
    );
    globalThis.fetch = fetchMock;

    const { fetchDramasServer } = await import('./server-api');
    await fetchDramasServer({ featured: true, pageSize: 8 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dramavela.com/dramas?featured=true&pageSize=8',
      { cache: 'no-store' },
    );
  });
});
