/**
 * React Query keys + fetchers for the public reading surface.
 *
 * Cache keys are tuples (`['books', 'featured']`) so React Query can
 * invalidate by prefix. Keep the key shape stable — they're the cache
 * primary key and changing them silently invalidates everything.
 */
import { ApiError, apiFetch } from './api';
import type {
  AuthUser,
  BookDetail,
  BookSummary,
  CategoryCount,
  ChapterSummary,
  Paginated,
  ReadingProgressEntry,
} from './types';

export const queryKeys = {
  me: ['auth', 'me'] as const,
  featured: ['books', 'featured'] as const,
  trending: ['books', 'trending'] as const,
  categories: ['books', 'categories'] as const,
  list: (params: {
    category?: string;
    status?: string;
    featured?: boolean;
    page?: number;
    limit?: number;
  }) => ['books', 'list', params] as const,
  book: (id: string) => ['books', 'detail', id] as const,
  bookChapters: (id: string, page: number, limit: number) =>
    ['books', 'chapters', id, page, limit] as const,
  readingProgress: ['reading-progress'] as const,
};

export const fetchMe = (): Promise<{ user: AuthUser }> => apiFetch('/auth/me');

/** Returns null when the visitor is anonymous (401), so React Query treats it as data. */
export const fetchMeOrNull = async (): Promise<AuthUser | null> => {
  try {
    const res = await fetchMe();
    return res.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
};

export const fetchFeatured = (): Promise<BookSummary[]> => apiFetch('/books/featured');
export const fetchTrending = (): Promise<BookSummary[]> => apiFetch('/books/trending');
export const fetchCategories = (): Promise<CategoryCount[]> => apiFetch('/books/categories');

export const fetchBooks = (params: {
  category?: string;
  status?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}): Promise<Paginated<BookSummary>> => apiFetch('/books', { query: params });

export const fetchBook = (id: string): Promise<BookDetail> =>
  apiFetch(`/books/${encodeURIComponent(id)}`);

export const fetchBookChapters = (
  id: string,
  page: number,
  limit: number,
): Promise<Paginated<ChapterSummary>> =>
  apiFetch(`/books/${encodeURIComponent(id)}/chapters`, { query: { page, limit } });

export const fetchReadingProgress = async (): Promise<ReadingProgressEntry[]> => {
  try {
    return await apiFetch('/reading-progress');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
};
