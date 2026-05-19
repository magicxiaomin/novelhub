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

  it('rounds progress text at zero and positive fractional boundaries without rendering an error state', () => {
    const html = renderToStaticMarkup(
      <ContinueReadingRailContent
        entries={[
          entry({
            bookId: 'zero-progress-book',
            chapterId: 'zero-progress-chapter',
            chapterNumber: 1,
            scrollPercent: 0,
            bookTitle: 'Zero Progress',
          }),
          entry({
            bookId: 'rounded-progress-book',
            chapterId: 'rounded-progress-chapter',
            chapterNumber: 2,
            scrollPercent: 42.6,
            bookTitle: 'Rounded Progress',
          }),
        ]}
      />,
    );

    expect(html).toContain('Zero Progress');
    expect(html).toContain('Chapter 1 · 0%');
    expect(html).toContain('Rounded Progress');
    expect(html).toContain('Chapter 2 · 43%');
    expect(html.toLowerCase()).not.toContain('error');
  });

  it('characterizes out-of-range progress text without clamping or visible error UI', () => {
    const html = renderToStaticMarkup(
      <ContinueReadingRailContent
        entries={[
          entry({
            bookId: 'negative-progress-book',
            chapterId: 'negative-progress-chapter',
            chapterNumber: 3,
            scrollPercent: -4.4,
            bookTitle: 'Negative Progress',
          }),
          entry({
            bookId: 'overflow-progress-book',
            chapterId: 'overflow-progress-chapter',
            chapterNumber: 4,
            scrollPercent: 120.5,
            bookTitle: 'Overflow Progress',
          }),
        ]}
      />,
    );

    expect(html).toContain('Negative Progress');
    expect(html).toContain('Chapter 3 · -4%');
    expect(html).toContain('Overflow Progress');
    expect(html).toContain('Chapter 4 · 121%');
    expect(html.toLowerCase()).not.toContain('error');
  });

  it('URL-encodes book ids containing reserved URL characters', () => {
    const html = renderToStaticMarkup(
      <ContinueReadingRailContent
        entries={[
          entry({
            bookId: 'book/with?reserved#chars & spaces',
            chapterId: 'encoded-book-chapter',
            chapterNumber: 5,
            bookTitle: 'Encoded Book',
          }),
        ]}
      />,
    );

    expect(html).toContain('Encoded Book');
    expect(html).toContain('href="/read/book%2Fwith%3Freserved%23chars%20%26%20spaces/5"');
  });

  it('renders at most one card per book before applying the 10-card cap', () => {
    const entries = [
      entry({
        bookId: 'book-1',
        chapterId: 'chapter-1',
        chapterNumber: 1,
        bookTitle: 'Book One Old',
      }),
      entry({
        bookId: 'book-1',
        chapterId: 'chapter-2',
        chapterNumber: 2,
        bookTitle: 'Book One New',
      }),
      ...Array.from({ length: 10 }, (_, index) =>
        entry({
          bookId: `book-${index + 2}`,
          chapterId: `chapter-${index + 2}`,
          chapterNumber: index + 2,
          bookTitle: `Book ${index + 2}`,
        }),
      ),
    ];

    const html = renderToStaticMarkup(<ContinueReadingRailContent entries={entries} />);

    expect(html.match(/href="\/read\//g)).toHaveLength(10);
    expect(html).toContain('Book One Old');
    expect(html).not.toContain('Book One New');
    expect(html).not.toContain('Book 11');
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

  it('keeps the first duplicate in input order when duplicate entries are adjacent', () => {
    const html = renderToStaticMarkup(
      <ContinueReadingRailContent
        entries={[
          entry({
            bookId: 'same-book',
            chapterId: 'same-book-first-chapter',
            chapterNumber: 3,
            bookTitle: 'Same Book First',
          }),
          entry({
            bookId: 'same-book',
            chapterId: 'same-book-second-chapter',
            chapterNumber: 4,
            bookTitle: 'Same Book Second',
          }),
          entry({
            bookId: 'next-book',
            chapterId: 'next-book-chapter',
            chapterNumber: 5,
            bookTitle: 'Next Book',
          }),
        ]}
      />,
    );

    expect(html.match(/href="\/read\//g)).toHaveLength(2);
    expect(html).toContain('Same Book First');
    expect(html).toContain('href="/read/same-book/3"');
    expect(html).not.toContain('Same Book Second');
    expect(html).toContain('Next Book');
    expect(html.indexOf('Same Book First')).toBeLessThan(html.indexOf('Next Book'));
  });

  it('keeps newest-first shelf order, latest-per-book dedup, and cap after dedup', () => {
    const entries = [
      entry({
        bookId: 'book-newest',
        chapterId: 'chapter-newest',
        chapterNumber: 9,
        bookTitle: 'Newest Book',
        updatedAt: '2026-05-19T12:00:00.000Z',
      }),
      entry({
        bookId: 'book-duplicate',
        chapterId: 'chapter-latest',
        chapterNumber: 8,
        bookTitle: 'Duplicate Latest',
        updatedAt: '2026-05-19T11:00:00.000Z',
      }),
      entry({
        bookId: 'book-middle',
        chapterId: 'chapter-middle',
        chapterNumber: 7,
        bookTitle: 'Middle Book',
        updatedAt: '2026-05-19T10:00:00.000Z',
      }),
      entry({
        bookId: 'book-duplicate',
        chapterId: 'chapter-older',
        chapterNumber: 6,
        bookTitle: 'Duplicate Older',
        updatedAt: '2026-05-18T10:00:00.000Z',
      }),
      ...[
        '2026-05-17T08:00:00.000Z',
        '2026-05-17T07:00:00.000Z',
        '2026-05-17T06:00:00.000Z',
        '2026-05-17T05:00:00.000Z',
        '2026-05-17T04:00:00.000Z',
        '2026-05-17T03:00:00.000Z',
        '2026-05-17T02:00:00.000Z',
        '2026-05-17T01:00:00.000Z',
        '2026-05-17T00:00:00.000Z',
      ].map((updatedAt, index) =>
        entry({
          bookId: `book-fill-${index + 1}`,
          chapterId: `chapter-fill-${index + 1}`,
          chapterNumber: index + 1,
          bookTitle: `Fill Book ${index + 1}`,
          updatedAt,
        }),
      ),
    ];

    const html = renderToStaticMarkup(<ContinueReadingRailContent entries={entries} />);

    expect(html.match(/href="\/read\//g)).toHaveLength(10);
    expect(html.indexOf('Newest Book')).toBeLessThan(html.indexOf('Duplicate Latest'));
    expect(html.indexOf('Duplicate Latest')).toBeLessThan(html.indexOf('Middle Book'));
    expect(html).toContain('href="/read/book-duplicate/8"');
    expect(html).not.toContain('Duplicate Older');
    expect(html).toContain('Fill Book 7');
    expect(html).not.toContain('Fill Book 8');
    expect(html).not.toContain('Fill Book 9');
  });
});
