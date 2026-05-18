import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BookCard } from './book-card';
import type { BookSummary } from '@/lib/types';

const baseBook: BookSummary = {
  id: 'book-1',
  title: 'Midnight Archive',
  author: 'NovelHub',
  coverUrl: '/covers/midnight.png',
  category: 'Fantasy',
  tags: ['Magic', 'Academy', 'Slow Burn'],
  status: 'ONGOING',
  isFeatured: false,
  totalChapters: 42,
  freeChapterCount: 6,
  coinPerChapter: 10,
};

function render(book: BookSummary): string {
  return renderToStaticMarkup(<BookCard book={book} />);
}

describe('BookCard metadata', () => {
  it('renders compact scan-time metadata from full book data', () => {
    const html = render(baseBook);

    expect(html).toContain('Magic');
    expect(html).toContain('Academy');
    expect(html).not.toContain('Slow Burn');
    expect(html).toContain('Ongoing');
    expect(html).toContain('42 chapters');
    expect(html).toContain('6 free chapters');
    expect(html).not.toContain('ONGOING');
  });

  it('renders partial metadata without empty or raw enum values', () => {
    const html = render({
      ...baseBook,
      tags: ['Mystery'],
      status: 'COMPLETED',
      totalChapters: 1,
      freeChapterCount: 0,
    });

    expect(html).toContain('Mystery');
    expect(html).toContain('Completed');
    expect(html).toContain('1 chapter');
    expect(html).not.toContain('0 free');
    expect(html).not.toContain('COMPLETED');
    expect(html).not.toContain('undefined');
  });

  it('collapses missing metadata cleanly', () => {
    const html = render({
      ...baseBook,
      tags: [],
      status: '',
      totalChapters: 0,
      freeChapterCount: 0,
    });

    expect(html).toContain('Midnight Archive');
    expect(html).toContain('NovelHub');
    expect(html).not.toContain('rounded-full bg-muted px-1.5');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });
});
