import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchBookChapters, queryKeys } from './queries';
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
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(chapters),
    })) as unknown as typeof fetch;

    await expect(fetchBookChapters('book-1', 2, 25)).resolves.toEqual(chapters);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/books/book-1/chapters?page=2&limit=25',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('percent-encodes book IDs when fetching chapters', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], total: 0, page: 1, limit: 10 }),
    })) as unknown as typeof fetch;

    await fetchBookChapters('book/with spaces?and=query', 1, 10);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/books/book%2Fwith%20spaces%3Fand%3Dquery/chapters?page=1&limit=10',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('uses a stable book chapters query key shape', () => {
    expect(queryKeys.bookChapters('book-1', 3, 50)).toEqual(['books', 'chapters', 'book-1', 3, 50]);
  });
});
