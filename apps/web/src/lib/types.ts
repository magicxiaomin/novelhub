/**
 * Mirrors the shapes returned by `apps/api`. Hand-written rather than
 * generated to keep the web bundle small. If these drift the integration
 * test (book listing fetch in the dev server) will surface the mismatch.
 */
export type AuthUser = {
  id: string;
  email: string;
  coinBalance: number;
  hasActiveSubscription: boolean;
};

export type BookSummary = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  category: string;
  tags: string[];
  status: string;
  isFeatured: boolean;
  totalChapters: number;
  freeChapterCount: number;
  coinPerChapter: number;
};

export type ChapterSummary = {
  id: string;
  bookId: string;
  order: number;
  title: string;
  isFree: boolean;
  wordCount: number;
};

export type BookDetail = BookSummary & {
  description: string;
  chapters: ChapterSummary[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type CategoryCount = {
  category: string;
  count: number;
};
