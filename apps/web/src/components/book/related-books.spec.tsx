import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RelatedBooks } from './related-books';
import type { BookSummary, Paginated } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  fetchBooks: vi.fn(),
  queryKeysList: vi.fn(),
  bookRail: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/lib/queries', () => ({
  fetchBooks: mocks.fetchBooks,
  queryKeys: {
    list: mocks.queryKeysList,
  },
}));

vi.mock('@/components/home/book-rail', () => ({
  BookRail: mocks.bookRail,
}));

const fantasyBook = book({ id: 'book-1', title: 'Moonlit Academy' });
const currentBook = book({ id: 'current-book', title: 'Current Book' });
const sequelBook = book({ id: 'book-2', title: 'Dragon Heir' });

function book(overrides: Partial<BookSummary>): BookSummary {
  return {
    id: 'book-id',
    title: 'Book Title',
    author: 'NovelHub',
    coverUrl: '/covers/book.png',
    category: 'Fantasy',
    tags: ['Magic'],
    status: 'ONGOING',
    isFeatured: false,
    totalChapters: 24,
    freeChapterCount: 5,
    coinPerChapter: 10,
    ...overrides,
  };
}

function page(items: BookSummary[]): Paginated<BookSummary> {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 10,
  };
}

function renderWithBooks(items: BookSummary[]): string {
  mocks.useQuery.mockReturnValue({ data: page(items) });

  return renderToStaticMarkup(<RelatedBooks bookId="current-book" category="Fantasy" />);
}

beforeEach(() => {
  vi.stubGlobal('React', React);
  mocks.useQuery.mockReset();
  mocks.fetchBooks.mockReset();
  mocks.queryKeysList.mockReset();
  mocks.bookRail.mockReset();
  mocks.queryKeysList.mockReturnValue(['books', 'list', { category: 'Fantasy', limit: 10 }]);
  mocks.fetchBooks.mockResolvedValue(page([]));
  mocks.bookRail.mockImplementation(({ title, books }: { title: string; books: BookSummary[] }) => {
    if (books.length === 0) return null;

    return (
      <section data-testid="book-rail">
        <h2>{title}</h2>
        {books.map((railBook) => (
          <article key={railBook.id}>{railBook.title}</article>
        ))}
      </section>
    );
  });
});

describe('RelatedBooks query contract', () => {
  it('keys and fetches related books by category with the fixed rail limit', () => {
    renderWithBooks([fantasyBook]);

    expect(mocks.queryKeysList).toHaveBeenCalledWith({ category: 'Fantasy', limit: 10 });
    expect(mocks.useQuery).toHaveBeenCalledWith({
      queryKey: ['books', 'list', { category: 'Fantasy', limit: 10 }],
      queryFn: expect.any(Function),
    });

    const queryOptions = mocks.useQuery.mock.calls[0]?.[0] as { queryFn: () => unknown };
    queryOptions.queryFn();
    expect(mocks.fetchBooks).toHaveBeenCalledWith({ category: 'Fantasy', limit: 10 });
  });

  it('filters the current book before delegating to BookRail', () => {
    const html = renderWithBooks([fantasyBook, currentBook, sequelBook]);

    expect(mocks.bookRail).toHaveBeenCalledWith(
      {
        title: 'You may also like',
        books: [fantasyBook, sequelBook],
      },
      expect.any(Object),
    );
    expect(html).toContain('Moonlit Academy');
    expect(html).toContain('Dragon Heir');
    expect(html).not.toContain('Current Book');
  });

  it.each([
    ['empty results', []],
    ['only the current book', [currentBook]],
  ] as const)('renders no rail for %s', (_label, items) => {
    const html = renderWithBooks([...items]);

    expect(mocks.bookRail).toHaveBeenCalledWith(
      {
        title: 'You may also like',
        books: [],
      },
      expect.any(Object),
    );
    expect(html).toBe('');
  });

  it('does not introduce drama imports on the related-books surface', () => {
    const source = readFileSync(new URL('./related-books.tsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/from ['"][^'"]*drama/i);
    expect(source).not.toMatch(/import\([^)]*drama/i);
  });
});
