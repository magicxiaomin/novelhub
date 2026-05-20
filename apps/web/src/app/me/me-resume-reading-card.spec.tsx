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

  it('rounds fractional progress to the nearest whole percent', () => {
    const roundedUpHtml = renderToStaticMarkup(
      <MeResumeReadingCard entries={[entry({ scrollPercent: 42.5 })]} />,
    );
    const roundedDownHtml = renderToStaticMarkup(
      <MeResumeReadingCard entries={[entry({ scrollPercent: 42.49 })]} />,
    );

    expect(roundedUpHtml).toContain('Chapter 7 · 43%');
    expect(roundedDownHtml).toContain('Chapter 7 · 42%');
  });

  it('renders out-of-range and NaN scrollPercent values without clamping', () => {
    // Characterization: MeResumeReadingCard currently delegates directly to Math.round
    // instead of validating/clamping resume.scrollPercent.
    const overRangeHtml = renderToStaticMarkup(
      <MeResumeReadingCard entries={[entry({ scrollPercent: 150.4 })]} />,
    );
    const underRangeHtml = renderToStaticMarkup(
      <MeResumeReadingCard entries={[entry({ scrollPercent: -12.6 })]} />,
    );
    const nanHtml = renderToStaticMarkup(
      <MeResumeReadingCard entries={[entry({ scrollPercent: Number.NaN })]} />,
    );

    expect(overRangeHtml).toContain('Chapter 7 · 150%');
    expect(underRangeHtml).toContain('Chapter 7 · -13%');
    expect(nanHtml).toContain('Chapter 7 · NaN%');
  });

  it('links to the reader route using encodeURIComponent parity for reserved bookId characters', () => {
    const bookId = 'book/unsafe ?x=#hash&space';
    const html = renderToStaticMarkup(
      <MeResumeReadingCard entries={[entry({ bookId, chapterNumber: 12 })]} />,
    );

    expect(html).toContain(`href="/read/${encodeURIComponent(bookId)}/12"`);
    expect(html).not.toContain('/book/');
  });

  it('uses entries[0] even when a later array item has the newer updatedAt', () => {
    const html = renderToStaticMarkup(
      <MeResumeReadingCard
        entries={[
          entry({
            bookTitle: 'Pinned By Position',
            chapterNumber: 3,
            updatedAt: '2026-05-01T00:00:00.000Z',
          }),
          entry({
            bookTitle: 'Newer Updated At',
            chapterNumber: 99,
            updatedAt: '2026-05-20T00:00:00.000Z',
          }),
        ]}
      />,
    );

    expect(html).toContain('Continue reading Pinned By Position · Ch 3');
    expect(html).not.toContain('Newer Updated At');
    expect(html).not.toContain('Ch 99');
  });
});
