import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiFetch } from './api';

const mockFetch = (
  status: number,
  body: unknown,
  ok = status >= 200 && status < 300,
): typeof fetch =>
  vi.fn(async () => ({
    ok,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  })) as unknown as typeof fetch;

describe('apiFetch', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('parses JSON on success', async () => {
    globalThis.fetch = mockFetch(200, { ok: true });
    const out = await apiFetch<{ ok: boolean }>('/health');
    expect(out).toEqual({ ok: true });
  });

  it('builds URLs with query params, skipping undefined', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url) => {
      calls.push(String(url));
      return { ok: true, status: 200, text: async () => JSON.stringify({}) };
    }) as unknown as typeof fetch;
    await apiFetch('/books', { query: { page: 2, limit: undefined, q: 'x' } });
    expect(calls[0]).toBe('http://api.test/books?page=2&q=x');
  });

  it('supports same-origin API proxy paths', async () => {
    process.env.NEXT_PUBLIC_API_URL = '/api-proxy';
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url) => {
      calls.push(String(url));
      return { ok: true, status: 200, text: async () => JSON.stringify({}) };
    }) as unknown as typeof fetch;

    await apiFetch('/books/featured', { query: { limit: 10 } });

    expect(calls[0]).toBe('/api-proxy/books/featured?limit=10');
  });

  it('throws ApiError with status + message on non-2xx', async () => {
    globalThis.fetch = mockFetch(404, { message: 'Not found' }, false);
    await expect(apiFetch('/books/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Not found',
    });
    expect(new ApiError('m', 1, null)).toBeInstanceOf(ApiError);
  });

  it('returns undefined for 204 No Content', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 204,
      text: async () => '',
    })) as unknown as typeof fetch;
    const out = await apiFetch('/auth/logout', { method: 'POST' });
    expect(out).toBeUndefined();
  });

  it('serializes the body as JSON when provided', async () => {
    const calls: RequestInit[] = [];
    globalThis.fetch = vi.fn(async (_url, init) => {
      calls.push(init as RequestInit);
      return { ok: true, status: 200, text: async () => JSON.stringify({}) };
    }) as unknown as typeof fetch;
    await apiFetch('/auth/login', { method: 'POST', body: { email: 'a@b' } });
    expect(calls[0]?.body).toBe('{"email":"a@b"}');
    expect((calls[0]?.headers as Record<string, string>)?.['Content-Type']).toBe(
      'application/json',
    );
  });
});
