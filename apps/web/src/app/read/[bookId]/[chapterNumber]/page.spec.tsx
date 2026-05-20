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

const readerContentSpy = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));

vi.mock('@/components/reader/reader-content', () => ({
  ReaderContent: (props: {
    chapter: ChapterResponse;
    initialChapters: Paginated<ChapterSummary>;
    currentUrl: string;
    bookTitle: string;
    bookCover: string;
  }) => {
    readerContentSpy(props);
    return (
      <article data-reader-content="true">
        {props.initialChapters.items.map((chapter) => chapter.order).join(',')}
      </article>
    );
  },
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

const makeChapterSummary = (order: number, id = `chapter-${order}`): ChapterSummary => ({
  ...chapterSummary,
  id,
  order,
  title: `Chapter ${order}`,
});

const chaptersPage: Paginated<ChapterSummary> = {
  items: [chapterSummary],
  total: 1,
  page: 1,
  limit: 200,
};

const chaptersPageWith = (items: ChapterSummary[], page = 1): Paginated<ChapterSummary> => ({
  items,
  total: items.length,
  page,
  limit: 200,
});

const booksPage = (items: BookSummary[]): Paginated<BookSummary> => ({
  items,
  total: items.length,
  page: 1,
  limit: 12,
});

beforeEach(() => {
  vi.clearAllMocks();
  readerContentSpy.mockClear();
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
  it('passes the resolved chapter, merged chapter page, and canonical reader URL to ReaderContent', async () => {
    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '1' } });
    renderToStaticMarkup(element);

    expect(readerContentSpy).toHaveBeenCalledTimes(1);
    expect(readerContentSpy).toHaveBeenCalledWith({
      chapter,
      initialChapters: chaptersPage,
      currentUrl: '/read/current-book/1',
      bookTitle: 'Current Book',
      bookCover: '/covers/current.png',
    });
  });

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

describe('reader page initial chapter selection fallback', () => {
  it('renders from page 1 without a second chapters fetch when page 1 contains the requested chapter', async () => {
    vi.mocked(fetchBookChaptersServer).mockResolvedValue(
      chaptersPageWith([makeChapterSummary(1), makeChapterSummary(40)]),
    );
    vi.mocked(fetchChapterServer).mockResolvedValue({
      ...chapter,
      id: 'chapter-40',
      chapterNumber: 40,
      title: 'Chapter 40',
    });

    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '40' } });
    const html = renderToStaticMarkup(element);

    expect(fetchBookChaptersServer).toHaveBeenCalledTimes(1);
    expect(fetchBookChaptersServer).toHaveBeenCalledWith(book.id, 1, 200);
    expect(fetchChapterServer).toHaveBeenCalledWith('chapter-40');
    expect(html).toContain('data-reader-content="true"');
    expect(html).toContain('1,40');
  });

  it('fetches the requested 200-chapter page when page 1 misses a chapter above 200', async () => {
    vi.mocked(fetchBookChaptersServer)
      .mockResolvedValueOnce(chaptersPageWith([makeChapterSummary(1), makeChapterSummary(2)]))
      .mockResolvedValueOnce(chaptersPageWith([makeChapterSummary(400)], 2));
    vi.mocked(fetchChapterServer).mockResolvedValue({
      ...chapter,
      id: 'chapter-400',
      chapterNumber: 400,
      title: 'Chapter 400',
    });

    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '400' } });
    const html = renderToStaticMarkup(element);

    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(1, book.id, 1, 200);
    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(2, book.id, 2, 200);
    expect(fetchChapterServer).toHaveBeenCalledWith('chapter-400');
    expect(html).toContain('1,2,400');
  });

  it('merges, de-duplicates by id, and sorts chapters before passing them to ReaderContent', async () => {
    vi.mocked(fetchBookChaptersServer)
      .mockResolvedValueOnce(
        chaptersPageWith([makeChapterSummary(100, 'shared-chapter'), makeChapterSummary(1)]),
      )
      .mockResolvedValueOnce(
        chaptersPageWith(
          [
            makeChapterSummary(450),
            makeChapterSummary(100, 'shared-chapter'),
            makeChapterSummary(250),
          ],
          3,
        ),
      );
    vi.mocked(fetchChapterServer).mockResolvedValue({
      ...chapter,
      id: 'chapter-450',
      chapterNumber: 450,
      title: 'Chapter 450',
    });

    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '450' } });
    const html = renderToStaticMarkup(element);

    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(2, book.id, 3, 200);
    expect(fetchChapterServer).toHaveBeenCalledWith('chapter-450');
    expect(html).toContain('1,100,250,450');
  });

  it('calls notFound when the first chapters page is null', async () => {
    vi.mocked(fetchBookChaptersServer).mockResolvedValue(null);

    await expect(ReaderPage({ params: { bookId: book.id, chapterNumber: '1' } })).rejects.toThrow(
      'not found',
    );

    expect(fetchBookChaptersServer).toHaveBeenCalledTimes(1);
    expect(fetchChapterServer).not.toHaveBeenCalled();
  });

  it('uses page 1 only when the second chapters fetch is null', async () => {
    vi.mocked(fetchBookChaptersServer)
      .mockResolvedValueOnce(chaptersPageWith([makeChapterSummary(1), makeChapterSummary(2)]))
      .mockResolvedValueOnce(null);

    await expect(ReaderPage({ params: { bookId: book.id, chapterNumber: '201' } })).rejects.toThrow(
      'not found',
    );

    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(2, book.id, 2, 200);
    expect(fetchChapterServer).not.toHaveBeenCalled();
  });

  it('skips the second chapters fetch when a missed chapter is within the first 200', async () => {
    vi.mocked(fetchBookChaptersServer).mockResolvedValue(
      chaptersPageWith([makeChapterSummary(1), makeChapterSummary(2)]),
    );

    await expect(ReaderPage({ params: { bookId: book.id, chapterNumber: '200' } })).rejects.toThrow(
      'not found',
    );

    expect(fetchBookChaptersServer).toHaveBeenCalledTimes(1);
    expect(fetchBookChaptersServer).toHaveBeenCalledWith(book.id, 1, 200);
    expect(fetchChapterServer).not.toHaveBeenCalled();
  });

  it.each(['abc', '1abc', 'NaN'])(
    'calls notFound before server fetches for malformed chapterNumber %s',
    async (chapterNumber) => {
      await expect(ReaderPage({ params: { bookId: book.id, chapterNumber } })).rejects.toThrow(
        'not found',
      );

      expect(fetchBookServer).not.toHaveBeenCalled();
      expect(fetchBookChaptersServer).not.toHaveBeenCalled();
      expect(fetchChapterServer).not.toHaveBeenCalled();
      expect(fetchBooksServer).not.toHaveBeenCalled();
    },
  );

  it.each(['1.5', '2.25'])(
    'calls notFound before server fetches for non-integer chapterNumber %s',
    async (chapterNumber) => {
      await expect(ReaderPage({ params: { bookId: book.id, chapterNumber } })).rejects.toThrow(
        'not found',
      );

      expect(fetchBookServer).not.toHaveBeenCalled();
      expect(fetchBookChaptersServer).not.toHaveBeenCalled();
      expect(fetchChapterServer).not.toHaveBeenCalled();
      expect(fetchBooksServer).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1'])(
    'calls notFound before server fetches for non-positive chapterNumber %s',
    async (chapterNumber) => {
      await expect(ReaderPage({ params: { bookId: book.id, chapterNumber } })).rejects.toThrow(
        'not found',
      );

      expect(fetchBookServer).not.toHaveBeenCalled();
      expect(fetchBookChaptersServer).not.toHaveBeenCalled();
      expect(fetchChapterServer).not.toHaveBeenCalled();
      expect(fetchBooksServer).not.toHaveBeenCalled();
    },
  );

  it('resolves chapter 1 from the first page boundary without fetching the current page again', async () => {
    vi.mocked(fetchBookChaptersServer).mockResolvedValue(
      chaptersPageWith([makeChapterSummary(1), makeChapterSummary(200)]),
    );
    vi.mocked(fetchChapterServer).mockResolvedValue({
      ...chapter,
      id: 'chapter-1',
      chapterNumber: 1,
      title: 'Chapter 1',
    });

    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '1' } });
    const html = renderToStaticMarkup(element);

    expect(fetchBookChaptersServer).toHaveBeenCalledTimes(1);
    expect(fetchBookChaptersServer).toHaveBeenCalledWith(book.id, 1, 200);
    expect(fetchChapterServer).toHaveBeenCalledWith('chapter-1');
    expect(html).toContain('1,200');
  });

  it('fetches page 2 at the first current-page boundary above the initial 200 chapters', async () => {
    vi.mocked(fetchBookChaptersServer)
      .mockResolvedValueOnce(chaptersPageWith([makeChapterSummary(1), makeChapterSummary(200)]))
      .mockResolvedValueOnce(
        chaptersPageWith([makeChapterSummary(201), makeChapterSummary(400)], 2),
      );
    vi.mocked(fetchChapterServer).mockResolvedValue({
      ...chapter,
      id: 'chapter-201',
      chapterNumber: 201,
      title: 'Chapter 201',
    });

    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '201' } });
    const html = renderToStaticMarkup(element);

    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(1, book.id, 1, 200);
    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(2, book.id, 2, 200);
    expect(fetchChapterServer).toHaveBeenCalledWith('chapter-201');
    expect(html).toContain('1,200,201,400');
  });

  it('fetches and resolves the last-page boundary chapter when total is not a multiple of the page size', async () => {
    vi.mocked(fetchBookChaptersServer)
      .mockResolvedValueOnce({
        ...chaptersPageWith([makeChapterSummary(1), makeChapterSummary(200)]),
        total: 401,
      })
      .mockResolvedValueOnce({
        ...chaptersPageWith([makeChapterSummary(401)], 3),
        total: 401,
      });
    vi.mocked(fetchChapterServer).mockResolvedValue({
      ...chapter,
      id: 'chapter-401',
      chapterNumber: 401,
      title: 'Chapter 401',
    });

    const element = await ReaderPage({ params: { bookId: book.id, chapterNumber: '401' } });
    const html = renderToStaticMarkup(element);

    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(1, book.id, 1, 200);
    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(2, book.id, 3, 200);
    expect(fetchChapterServer).toHaveBeenCalledWith('chapter-401');
    expect(html).toContain('1,200,401');
  });

  it('treats an out-of-range chapter anchor as not found after checking the computed page', async () => {
    vi.mocked(fetchBookChaptersServer)
      .mockResolvedValueOnce({
        ...chaptersPageWith([makeChapterSummary(1), makeChapterSummary(200)]),
        total: 401,
      })
      .mockResolvedValueOnce({ ...chaptersPageWith([], 5), total: 401 });

    await expect(ReaderPage({ params: { bookId: book.id, chapterNumber: '999' } })).rejects.toThrow(
      'not found',
    );

    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(1, book.id, 1, 200);
    expect(fetchBookChaptersServer).toHaveBeenNthCalledWith(2, book.id, 5, 200);
    expect(fetchChapterServer).not.toHaveBeenCalled();
  });
});
