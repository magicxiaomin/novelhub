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
});
