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
import type * as NovelE2eFixtures from './novel-e2e-fixtures';
import type {
  BookDetail,
  BookSummary,
  CategoryCount,
  ChapterResponse,
  ChapterSummary,
  Paginated,
} from './types';

type LoadedNovelE2eFixtures = typeof NovelE2eFixtures;

const allowedNovelFixtureRuntimeEnvironments = ['development', 'test', 'ci', 'ci-e2e'];

const novelE2eFixturesEnabled = (): boolean => {
  const runtimeEnvironment = process.env.NOVELHUB_RUNTIME_ENV ?? process.env.NODE_ENV;
  // Production deployments must not enable fixtures; the ci-e2e runtime is set only
  // by the Playwright workflow for its standalone smoke-test server.
  if (process.env.NODE_ENV === 'production' && runtimeEnvironment !== 'ci-e2e') return false;
  if (process.env.NOVELHUB_E2E_NOVEL_FIXTURES !== '1') return false;

  return allowedNovelFixtureRuntimeEnvironments.some((allowed) => allowed === runtimeEnvironment);
};

const loadNovelE2eFixtures = async (): Promise<LoadedNovelE2eFixtures | null> => {
  if (!novelE2eFixturesEnabled()) return null;
  return import('./novel-e2e-fixtures');
};

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
  const novelFixtures = await loadNovelE2eFixtures();
  if (novelFixtures && id === novelFixtures.novelE2eFixtureBookId) {
    return novelFixtures.novelE2eFixtureBook;
  }

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
  const novelFixtures = await loadNovelE2eFixtures();
  if (novelFixtures) return novelFixtures.novelE2eFixtureBookList(query);

  const res = await fetch(buildServerApiUrl('/books', query), {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch books: ${res.status}`);
  }
  return (await res.json()) as Paginated<BookSummary>;
}

export async function fetchBookCategoriesServer(): Promise<CategoryCount[]> {
  const novelFixtures = await loadNovelE2eFixtures();
  if (novelFixtures) return novelFixtures.novelE2eFixtureCategories;

  const res = await fetch(buildServerApiUrl('/books/categories'), {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch book categories: ${res.status}`);
  }
  return (await res.json()) as CategoryCount[];
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
  const novelFixtures = await loadNovelE2eFixtures();
  if (novelFixtures) {
    if (id === novelFixtures.novelE2eFixtureBookId) {
      return { ...novelFixtures.novelE2eFixtureChapterList, page, limit };
    }
  }

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
  const novelFixtures = await loadNovelE2eFixtures();
  const novelFixtureChapter = novelFixtures?.novelE2eFixtureChapter(id);
  if (novelFixtureChapter) return novelFixtureChapter;

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
