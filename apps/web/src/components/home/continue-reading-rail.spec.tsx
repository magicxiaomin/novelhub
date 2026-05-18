import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ContinueReadingRailContent } from './continue-reading-rail';
import type { ReadingProgressEntry } from '@/lib/types';

const entry = (overrides: Partial<ReadingProgressEntry> = {}): ReadingProgressEntry => ({
  bookId: 'book with spaces',
  chapterId: 'chapter-uuid',
  chapterNumber: 7,
  scrollPercent: 42,
  bookTitle: 'The Last Ember',
  bookCover: '/covers/ember.svg',
  updatedAt: '2026-05-17T00:00:00.000Z',
  ...overrides,
});

describe('ContinueReadingRailContent', () => {
  it('renders anonymous reading progress entries', () => {
    const html = renderToStaticMarkup(<ContinueReadingRailContent entries={[entry()]} />);

    expect(html).toContain('Continue Reading');
    expect(html).toContain('The Last Ember');
    expect(html).toContain('Chapter 7 · 42%');
    expect(html).toContain('href="/read/book%20with%20spaces/7"');
  });

  it('renders no rail markup when there are no entries', () => {
    const html = renderToStaticMarkup(<ContinueReadingRailContent entries={[]} />);

    expect(html).toBe('');
    expect(html).not.toContain('Continue Reading');
    expect(html).not.toContain('Start a free chapter to save your spot on this device.');
  });

  it('caps rendered progress entries at 10 cards', () => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      entry({
        bookId: `book-${index + 1}`,
        chapterId: `chapter-${index + 1}`,
        bookTitle: `Book ${index + 1}`,
      }),
    );

    const html = renderToStaticMarkup(<ContinueReadingRailContent entries={entries} />);

    expect(html.match(/href="\/read\//g)).toHaveLength(10);
    expect(html).toContain('Book 10');
    expect(html).not.toContain('Book 11');
    expect(html).not.toContain('Book 12');
  });
});
