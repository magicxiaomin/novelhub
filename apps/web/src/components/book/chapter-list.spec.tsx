import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ChapterList } from './chapter-list';
import type { ChapterSummary } from '@/lib/types';

let queryState: { data?: unknown; isFetching: boolean; isError?: boolean } = {
  data: undefined,
  isFetching: false,
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => queryState,
}));

const chapters: ChapterSummary[] = [
  {
    id: 'chapter-1',
    bookId: 'book-1',
    order: 1,
    title: 'First Moon',
    isFree: true,
    wordCount: 1234,
  },
  {
    id: 'chapter-2',
    bookId: 'book-1',
    order: 2,
    title: 'Locked Gate',
    isFree: false,
    wordCount: 4321,
  },
];

describe('ChapterList loading and error states', () => {
  it('labels locked chapter icons without adding unlabeled icon-only controls to the list', () => {
    queryState = { data: undefined, isFetching: false };

    const html = renderToStaticMarkup(
      <ChapterList bookId="book-1" chapters={chapters} totalChapters={2} />,
    );

    expect(html).toContain('href="/read/book-1/1"');
    expect(html).toContain('href="/read/book-1/2"');
    expect(html).toContain('aria-label="Locked"');
    expect(html).toContain('Free');
    expect(html).not.toContain('<button');
  });

  it('shows a loading affordance and disables loading while more chapters are being fetched', () => {
    queryState = { data: undefined, isFetching: true };

    const html = renderToStaticMarkup(
      <ChapterList bookId="book-1" chapters={chapters.slice(0, 1)} totalChapters={2} />,
    );

    expect(html).toContain('First Moon');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Loading more chapters');
  });

  it('shows a localized error when loading more chapters fails', () => {
    queryState = { data: undefined, isFetching: false, isError: true };

    const html = renderToStaticMarkup(
      <ChapterList bookId="book-1" chapters={chapters.slice(0, 1)} totalChapters={2} />,
    );

    expect(html).toContain('Chapters could not be loaded. Please try again.');
    expect(html).toContain('Load more chapters');
  });
});

describe('ChapterList empty state', () => {
  it('renders a localized empty state instead of an empty bordered list when no chapters are available', () => {
    queryState = { data: undefined, isFetching: false };

    const html = renderToStaticMarkup(
      <ChapterList bookId="book-1" chapters={[]} totalChapters={0} />,
    );

    expect(html).toContain('No chapters available yet');
    expect(html).toContain('Check back soon for the first chapter.');
    expect(html).not.toContain('<ol');
    expect(html).not.toContain('href="/read/book-1/');
  });
});
