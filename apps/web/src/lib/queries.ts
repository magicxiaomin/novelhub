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
  ChapterReadingProgress,
  ChapterSummary,
  ChapterResponse,
  ChapterUnlock,
  CheckoutSession,
  Paginated,
  PaymentOrder,
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
  chapter: (id: string) => ['chapters', 'detail', id] as const,
  chapterContent: (id: string) => ['chapters', 'content', id] as const,
  unlocks: (page: number, limit: number) => ['unlocks', page, limit] as const,
  order: (sessionId: string) => ['payments', 'orders', sessionId] as const,
  readingProgress: ['reading-progress'] as const,
  readingProgressForChapter: (bookId: string, chapterId: string) =>
    ['reading-progress', bookId, chapterId] as const,
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

export const fetchChapter = (id: string): Promise<ChapterResponse> =>
  apiFetch(`/chapters/${encodeURIComponent(id)}`);

export const unlockChapter = (chapterId: string): Promise<ChapterResponse> =>
  apiFetch(`/unlocks/chapter/${encodeURIComponent(chapterId)}`, { method: 'POST' });

export const fetchUnlocks = (page: number, limit: number): Promise<Paginated<ChapterUnlock>> =>
  apiFetch('/unlocks', { query: { page, limit } });

export const createCoinCheckout = (packageId: string): Promise<CheckoutSession> =>
  apiFetch('/payments/checkout/coins', { method: 'POST', body: { packageId } });

export const createSubscriptionCheckout = (plan: string): Promise<CheckoutSession> =>
  apiFetch('/payments/checkout/subscription', { method: 'POST', body: { plan } });

export const fetchPaymentOrder = (sessionId: string): Promise<PaymentOrder> =>
  apiFetch(`/payments/orders/${encodeURIComponent(sessionId)}`);

export const fetchReadingProgress = async (): Promise<ReadingProgressEntry[]> => {
  try {
    return await apiFetch('/reading-progress');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
};

export const fetchChapterReadingProgress = async (
  bookId: string,
  chapterId: string,
): Promise<ChapterReadingProgress | null> => {
  try {
    const result = await apiFetch<ChapterReadingProgress | null>('/reading-progress', {
      query: { bookId, chapterId },
    });
    return result;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
};

export const saveReadingProgress = async (
  chapterId: string,
  scrollPercent: number,
): Promise<boolean> => {
  try {
    await apiFetch('/reading-progress', {
      method: 'POST',
      body: { chapterId, scrollPercent },
    });
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return false;
    throw err;
  }
};
