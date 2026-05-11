/**
 * Server-side fetcher used by RSC pages (metadata + first paint).
 *
 * The browser-side `apiFetch` from `@/lib/api` reads cookies — that doesn't
 * work in a Server Component because there's no browser. For metadata
 * generation and the initial render we hit the API anonymously: the public
 * book endpoints don't require auth.
 *
 * Returns null on 404 / 401 so callers can call `notFound()` cleanly
 * instead of try/catching.
 */
import { cookies } from 'next/headers';

import { internalApiBaseUrl, publicApiBaseUrl } from './api-config';
import type {
  BookDetail,
  BookSummary,
  ChapterResponse,
  ChapterSummary,
  DramaDetail,
  DramaPaginated,
  DramaSummary,
  Paginated,
} from './types';

const apiBase = (): string => {
  const base = publicApiBaseUrl();
  return base.startsWith('/') ? internalApiBaseUrl() : base;
};

export const buildServerApiUrl = (
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${apiBase().replace(/\/+$/, '')}${normalizedPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
};

export async function fetchBookServer(id: string): Promise<BookDetail | null> {
  const res = await fetch(buildServerApiUrl(`/books/${encodeURIComponent(id)}`), {
    // Avoid Next's default fetch caching — book detail can change as
    // chapters land. ISR could be added later if traffic warrants.
    cache: 'no-store',
  });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch book ${id}: ${res.status}`);
  }
  return (await res.json()) as BookDetail;
}

export async function fetchBooksServer(query?: {
  category?: string;
  status?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}): Promise<Paginated<BookSummary>> {
  const res = await fetch(buildServerApiUrl('/books', query), {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch books: ${res.status}`);
  }
  return (await res.json()) as Paginated<BookSummary>;
}

const cookieHeader = (): string => {
  try {
    return cookies().toString();
  } catch {
    return '';
  }
};

export async function fetchBookChaptersServer(
  id: string,
  page = 1,
  limit = 200,
): Promise<Paginated<ChapterSummary> | null> {
  const res = await fetch(
    buildServerApiUrl(`/books/${encodeURIComponent(id)}/chapters`, { page, limit }),
    {
      cache: 'no-store',
      headers: { cookie: cookieHeader() },
    },
  );
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch chapters for book ${id}: ${res.status}`);
  }
  return (await res.json()) as Paginated<ChapterSummary>;
}

export async function fetchChapterServer(id: string): Promise<ChapterResponse | null> {
  const res = await fetch(buildServerApiUrl(`/chapters/${encodeURIComponent(id)}`), {
    cache: 'no-store',
    headers: { cookie: cookieHeader() },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch chapter ${id}: ${res.status}`);
  }
  return (await res.json()) as ChapterResponse;
}

export async function fetchDramasServer(query?: {
  category?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<DramaPaginated<DramaSummary>> {
  const res = await fetch(buildServerApiUrl('/dramas', query), {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch dramas: ${res.status}`);
  }
  return (await res.json()) as DramaPaginated<DramaSummary>;
}

export async function fetchDramaServer(slug: string): Promise<DramaDetail | null> {
  const res = await fetch(buildServerApiUrl(`/dramas/${encodeURIComponent(slug)}`), {
    cache: 'no-store',
    headers: { cookie: cookieHeader() },
  });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch drama ${slug}: ${res.status}`);
  }
  return (await res.json()) as DramaDetail;
}
