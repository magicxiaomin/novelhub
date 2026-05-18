import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MoreLikeThis } from './more-like-this';
import type { BookSummary } from '@/lib/types';

const book = (id: string): BookSummary => ({
  id,
  title: `Book ${id}`,
  author: 'NovelHub',
  coverUrl: `/covers/${id}.png`,
  category: 'Fantasy',
  tags: [],
  status: 'ONGOING',
  isFeatured: false,
  totalChapters: 12,
  freeChapterCount: 3,
  coinPerChapter: 10,
});

describe('MoreLikeThis', () => {
  it('renders a browse all novels fallback when the selected books list is empty', () => {
    const html = renderToStaticMarkup(<MoreLikeThis books={[]} />);

    expect(html).toContain('More like this');
    expect(html).toContain('Browse all novels');
    expect(html).toContain('href="/novels"');
    expect(html).not.toContain('Book a');
  });

  it('renders the existing card rail when books are provided', () => {
    const html = renderToStaticMarkup(<MoreLikeThis books={[book('a'), book('b'), book('c')]} />);

    expect(html).toContain('More like this');
    expect(html).toContain('Book a');
    expect(html).toContain('Book b');
    expect(html).toContain('Book c');
    expect(html).toContain('href="/book/a"');
    expect(html).not.toContain('Browse all novels');
  });
});
