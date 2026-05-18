import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BookCard, BookCardSkeleton } from './book-card';
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

describe('BookCardSkeleton', () => {
  it('matches the medium BookCard footprint without exposing busy content', () => {
    const html = renderToStaticMarkup(<BookCardSkeleton />);

    expect(html).toContain('w-36');
    expect(html).toContain('aspect-[3/4]');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-testid="book-card-skeleton"');
    expect(html).not.toContain('href=');
  });

  it('matches the small BookCard footprint and documents reduced-motion animation gating', () => {
    const html = renderToStaticMarkup(<BookCardSkeleton size="sm" />);

    expect(html).toContain('w-28');
    expect(html).toContain('motion-safe:animate-pulse');
    expect(html).toContain('motion-reduce:animate-none');
    expect(html).toMatchInlineSnapshot(`
      "<div class="flex shrink-0 flex-col gap-2 w-28" aria-hidden="true" data-testid="book-card-skeleton"><div class="relative overflow-hidden rounded-xl bg-muted motion-safe:animate-pulse motion-reduce:animate-none aspect-[3/4] w-28"></div><div class="flex flex-col gap-1"><div class="h-8 rounded-md bg-muted motion-safe:animate-pulse motion-reduce:animate-none"></div><div class="h-3 w-20 rounded-md bg-muted motion-safe:animate-pulse motion-reduce:animate-none"></div><div class="mt-1 flex gap-1"><div class="h-5 w-10 rounded-full bg-muted motion-safe:animate-pulse motion-reduce:animate-none"></div><div class="h-5 w-12 rounded-full bg-muted motion-safe:animate-pulse motion-reduce:animate-none"></div></div><div class="h-3 w-24 rounded-md bg-muted motion-safe:animate-pulse motion-reduce:animate-none"></div></div></div>"
    `);
  });
});
