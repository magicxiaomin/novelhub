import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MeResumeReadingCard } from './me-resume-reading-card';
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

describe('MeResumeReadingCard', () => {
  it('renders the most recent resume card when reading progress has at least one row', () => {
    const html = renderToStaticMarkup(
      <MeResumeReadingCard
        entries={[entry(), entry({ bookTitle: 'Older Book', chapterNumber: 2 })]}
      />,
    );

    expect(html).toContain('Continue reading The Last Ember · Ch 7');
    expect(html).not.toContain('Older Book');
  });

  it('renders nothing when reading progress is empty', () => {
    const html = renderToStaticMarkup(<MeResumeReadingCard entries={[]} />);

    expect(html).toBe('');
  });

  it('links to the reader route using bookId and chapterNumber', () => {
    const html = renderToStaticMarkup(
      <MeResumeReadingCard entries={[entry({ bookId: 'book/unsafe', chapterNumber: 12 })]} />,
    );

    expect(html).toContain('href="/read/book%2Funsafe/12"');
    expect(html).not.toContain('/book/book%2Funsafe/chapter/12');
  });
});
