import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BookPage, { generateMetadata } from './page';
import { fetchBookServer } from '@/lib/server-api';
import type { BookDetail } from '@/lib/types';
import { notFound } from 'next/navigation';

const chapterListPropsSpy = vi.hoisted(() => vi.fn());
const stickyStartReadingPropsSpy = vi.hoisted(() => vi.fn());

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => React.createElement('img', { alt, src }),
}));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
  usePathname: vi.fn(() => '/book/book-seo-264'),
}));
vi.mock('@/components/book/chapter-list', () => ({
  ChapterList: (props: {
    bookId: string;
    chapters: BookDetail['chapters'];
    totalChapters: number;
  }) => {
    chapterListPropsSpy(props);
    return React.createElement('section', { 'data-chapter-list': true });
  },
}));
vi.mock('@/components/book/collapsible-description', () => ({
  CollapsibleDescription: ({ text }: { text: string }) =>
    React.createElement('section', null, text),
}));
vi.mock('@/components/book/book-view-content-event', () => ({
  BookViewContentEvent: () => React.createElement('span'),
}));
vi.mock('@/components/book/related-books', () => ({
  RelatedBooks: () => React.createElement('section', { 'data-related-books': true }),
}));
vi.mock('@/components/book/sticky-cta', () => ({
  StickyStartReading: (props: { bookId: string; firstChapterOrder: number }) => {
    stickyStartReadingPropsSpy(props);
    return React.createElement(
      'a',
      {
        'data-sticky-start-reading': true,
        href: `/read/${encodeURIComponent(props.bookId)}/${props.firstChapterOrder}`,
      },
      'Start reading',
    );
  },
}));
vi.mock('@/lib/server-api', () => ({ fetchBookServer: vi.fn() }));

const mockedFetchBookServer = vi.mocked(fetchBookServer);
const mockedNotFound = vi.mocked(notFound);

const book: BookDetail = {
  id: 'book-seo-264',
  title: 'Validation Moon',
  author: 'Regression Author',
  coverUrl: 'https://cdn.example.test/covers/validation-moon.png',
  category: 'Fantasy',
  tags: ['validation'],
  status: 'ongoing',
  isFeatured: false,
  totalChapters: 12,
  freeChapterCount: 3,
  coinPerChapter: 10,
  description: 'A regression novel used to pin book detail SEO previews.',
  chapters: [
    {
      id: 'chapter-1',
      bookId: 'book-seo-264',
      order: 1,
      title: 'First',
      isFree: true,
      wordCount: 3000,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('React', React);
});

describe('book detail metadata', () => {
  it('uses the book payload for SEO, Open Graph, and Twitter previews', async () => {
    mockedFetchBookServer.mockResolvedValueOnce(book);

    const metadata = await generateMetadata({ params: { id: book.id } });

    expect(mockedFetchBookServer).toHaveBeenCalledWith(book.id);
    expect(metadata.title).toBe('Validation Moon — Regression Author');
    expect(metadata.description).toBe(book.description);
    expect(metadata.openGraph).toMatchObject({
      title: 'Validation Moon — Regression Author',
      description: book.description,
      type: 'book',
      images: [{ url: book.coverUrl, alt: 'Cover art for Validation Moon' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Validation Moon — Regression Author',
      description: book.description,
      images: [book.coverUrl],
    });
  });
});

describe('book detail page render', () => {
  it('renders the server-fetched book detail contract', async () => {
    mockedFetchBookServer.mockResolvedValueOnce(book);

    const html = renderToStaticMarkup(await BookPage({ params: { id: book.id } }));

    expect(mockedFetchBookServer).toHaveBeenCalledWith(book.id);
    for (const text of ['Validation Moon', 'Regression Author', 'Fantasy', 'ongoing']) {
      expect(html).toContain(text);
    }
    for (const stat of ['12', 'Chapters', '3K', 'Words', '★', 'Rating']) {
      expect(html).toContain(stat);
    }
    expect(html).toContain(`src="${book.coverUrl}"`);
    expect(html).toContain('alt=""');
    expect(html).toContain(book.description);
    expect(html).toContain('data-chapter-list="true"');
    expect(html).toContain('data-related-books="true"');
    expect(html).toContain('data-sticky-start-reading="true"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Book"');
    expect(html).toContain(`"name":"${book.title}"`);
  });

  it('hands the route id and fetched chapter order to current read-entry components', async () => {
    mockedFetchBookServer.mockResolvedValueOnce({
      ...book,
      id: 'book with spaces',
      chapters: [{ ...book.chapters[0]!, order: 7 }],
    });

    const html = renderToStaticMarkup(await BookPage({ params: { id: 'book with spaces' } }));

    expect(mockedFetchBookServer).toHaveBeenCalledWith('book with spaces');
    expect(chapterListPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: 'book with spaces',
        chapters: [{ ...book.chapters[0]!, order: 7 }],
        totalChapters: book.totalChapters,
      }),
    );
    expect(stickyStartReadingPropsSpy).toHaveBeenCalledWith({
      bookId: 'book with spaces',
      firstChapterOrder: 7,
    });
    expect(html).toContain('href="/read/book%20with%20spaces/7"');
    expect(html).not.toContain('novelId=');
    expect(html).not.toContain('/drama');
  });

  it('calls notFound when the server fetch returns null', async () => {
    mockedFetchBookServer.mockResolvedValueOnce(null);

    await expect(BookPage({ params: { id: book.id } })).rejects.toThrow('not found');
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
  });
});
