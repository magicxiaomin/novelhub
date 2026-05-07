import { apiFetch } from '@/lib/api';
import type { BookDetail, Paginated } from '@/lib/types';

export type AdminDashboardSummary = {
  today: { signups: number; payingUsers: number; revenueCents: number; estimatedRoasCents: number };
  weekly: Array<{ date: string; signups: number; revenueCents: number }>;
  topBooks: Array<{ id: string; title: string; coverUrl?: string; revenueCents: number }>;
};

export type AdminBook = Pick<
  BookDetail,
  | 'id'
  | 'title'
  | 'author'
  | 'coverUrl'
  | 'description'
  | 'category'
  | 'tags'
  | 'status'
  | 'freeChapterCount'
  | 'coinPerChapter'
> & { coverImageKey: string | null };

export type AdminChapter = {
  id: string;
  bookId: string;
  bookTitle?: string;
  order: number;
  title: string;
  isFree: boolean;
  wordCount?: number;
  content?: string;
  updatedAt?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  coinBalance: number;
  isAdmin: boolean;
  bannedAt: string | null;
  createdAt: string;
  purchases?: { count: number; sumCents: number };
  unlocks?: { count: number };
};

export type AdminOrder = {
  id: string;
  userEmail: string;
  stripeSessionId: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export const adminApi = {
  dashboard: (): Promise<AdminDashboardSummary> => apiFetch('/admin/dashboard/summary'),
  books: (): Promise<Paginated<AdminBook>> => apiFetch('/admin/books', { query: { limit: 100 } }),
  book: (id: string): Promise<AdminBook> => apiFetch(`/admin/books/${encodeURIComponent(id)}`),
  createBook: (body: Omit<AdminBook, 'id' | 'coverImageKey'>): Promise<{ id: string }> =>
    apiFetch('/admin/books', { method: 'POST', body }),
  updateBook: (id: string, body: Partial<AdminBook>): Promise<{ id: string }> =>
    apiFetch(`/admin/books/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  deleteBook: (id: string): Promise<{ id: string }> =>
    apiFetch(`/admin/books/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  coverUploadUrl: (contentType: string): Promise<{ uploadUrl: string; key: string }> =>
    apiFetch('/admin/uploads/cover-url', { method: 'POST', body: { contentType } }),
  chapters: (bookId?: string): Promise<Paginated<AdminChapter>> =>
    apiFetch('/admin/chapters', { query: { limit: 100, bookId } }),
  chapter: (id: string): Promise<AdminChapter> =>
    apiFetch(`/admin/chapters/${encodeURIComponent(id)}`),
  updateChapter: (id: string, body: Partial<AdminChapter>): Promise<{ id: string }> =>
    apiFetch(`/admin/chapters/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  bulkChapters: (
    bookId: string,
    chapters: Array<{ title: string; content: string; isFree?: boolean }>,
  ): Promise<{ created: number }> =>
    apiFetch(`/admin/books/${encodeURIComponent(bookId)}/chapters/bulk`, {
      method: 'POST',
      body: { chapters },
    }),
  users: (search?: string): Promise<Paginated<AdminUser>> =>
    apiFetch('/admin/users', { query: { limit: 100, search } }),
  user: (id: string): Promise<AdminUser> => apiFetch(`/admin/users/${encodeURIComponent(id)}`),
  banUser: (id: string): Promise<{ id: string }> =>
    apiFetch(`/admin/users/${encodeURIComponent(id)}/ban`, { method: 'POST' }),
  unbanUser: (id: string): Promise<{ id: string }> =>
    apiFetch(`/admin/users/${encodeURIComponent(id)}/unban`, { method: 'POST' }),
  orders: (params: { search?: string; status?: string }): Promise<Paginated<AdminOrder>> =>
    apiFetch('/admin/orders', { query: { limit: 100, ...params } }),
  push: (body: {
    title: string;
    body: string;
    url?: string;
    segment: string;
  }): Promise<{ sent: boolean; id?: string }> =>
    apiFetch('/admin/push/broadcast', {
      method: 'POST',
      body: { title: body.title, body: body.body, url: body.url, segmentName: body.segment },
    }),
};
