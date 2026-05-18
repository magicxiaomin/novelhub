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

  it('renders an empty anonymous shelf when there are no entries', () => {
    const html = renderToStaticMarkup(<ContinueReadingRailContent entries={[]} showEmptyState />);

    expect(html).toContain('Continue Reading');
    expect(html).toContain('Start a free chapter to save your spot on this device.');
  });
});
