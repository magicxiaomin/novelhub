import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReaderPage from './page';
import {
  fetchBookChaptersServer,
  fetchBooksServer,
  fetchBookServer,
  fetchChapterServer,
} from '@/lib/server-api';
import type {
  BookDetail,
  BookSummary,
  ChapterResponse,
  ChapterSummary,
  Paginated,
} from '@/lib/types';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));

vi.mock('@/components/reader/reader-content', () => ({
  ReaderContent: () => <article data-reader-content="true">Reader content</article>,
}));

vi.mock('@/components/reader/more-like-this', () => ({
  MoreLikeThis: ({ books }: { books: BookSummary[] }) => (
    <section data-more-like-this="true">{books.map((book) => book.id).join(',')}</section>
  ),
}));

vi.mock('@/lib/server-api', () => ({
  fetchBookChaptersServer: vi.fn(),
  fetchBooksServer: vi.fn(),
  fetchBookServer: vi.fn(),
  fetchChapterServer: vi.fn(),
}));

const book: BookDetail = {
  id: 'current-book',
  title: 'Current Book',
  author: 'NovelHub',
  coverUrl: '/covers/current.png',
  category: 'Fantasy',
  tags: [],
  status: 'ONGOING',
  isFeatured: false,
  totalChapters: 10,
  freeChapterCount: 3,
  coinPerChapter: 10,
  description: 'Current book description.',
  chapters: [],
};

const chapterSummary: ChapterSummary = {
  id: 'chapter-1',
  bookId: book.id,
  order: 1,
  title: 'Opening Gate',
  isFree: true,
  wordCount: 1200,
};

const chapter: ChapterResponse = {
  id: chapterSummary.id,
  bookId: book.id,
  chapterNumber: 1,
  title: chapterSummary.title,
  isLocked: false,
  contentUrl: 'https://cdn.example.test/chapter.txt',
  wordCount: 1200,
  prevChapterId: null,
  nextChapterId: null,
};

const candidate = (id: string): BookSummary => ({
  id,
  title: `Book ${id}`,
  author: 'NovelHub',
  coverUrl: `/covers/${id}.png`,
  category: book.category,
  tags: [],
  status: book.status,
  isFeatured: false,
  totalChapters: 8,
  freeChapterCount: 3,
  coinPerChapter: 10,
});

const chaptersPage: Paginated<ChapterSummary> = {
  items: [chapterSummary],
  total: 1,
  page: 1,
  limit: 200,
};

const booksPage = (items: BookSummary[]): Paginated<BookSummary> => ({
  items,
  total: items.length,
  page: 1,
  limit: 12,
});

beforeEach(() => {
  vi.mocked(fetchBookServer).mockResolvedValue(book);
  vi.mocked(fetchBookChaptersServer).mockResolvedValue(chaptersPage);
  vi.mocked(fetchChapterServer).mockResolvedValue(chapter);
  vi.mocked(fetchBooksServer).mockResolvedValue(
    booksPage([
      candidate('a'),
      book,
      candidate('b'),
      candidate('c'),
      candidate('d'),
      candidate('e'),
    ]),
  );
});

describe('reader page more like this', () => {
  it('fetches a bounded category/status list and renders the deterministic top four excluding current book', async () => {
    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '1' } });
    const html = renderToStaticMarkup(element);

    expect(fetchBooksServer).toHaveBeenCalledWith({
      category: book.category,
      status: book.status,
      page: 1,
      limit: 12,
    });
    expect(html).toContain('data-more-like-this="true"');
    expect(html).toContain('a,b,c,d');
  });

  it('keeps reader metadata to a single JSON-LD script block', async () => {
    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '1' } });
    const html = renderToStaticMarkup(element);

    expect(html.match(/type="application\/ld\+json"/g)).toHaveLength(1);
  });

  it('keeps the reader available when related books cannot be fetched', async () => {
    vi.mocked(fetchBooksServer).mockRejectedValue(new Error('related books unavailable'));

    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '1' } });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-reader-content="true"');
    expect(html).toContain('data-more-like-this="true"');
    expect(html).not.toContain('a,b,c,d');
  });
});
