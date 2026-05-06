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

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type BookDetail = BookSummary & {
  description: string;
  chapters: ChapterSummary[];
};

export type CategoryCount = {
  category: string;
  count: number;
};
