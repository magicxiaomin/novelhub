import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BookCard, BookCardSkeleton } from './book-card';
import type { BookSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

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

function classAttributeFor(html: string, marker: string): string {
  const index = html.indexOf(marker);
  expect(index).toBeGreaterThanOrEqual(0);

  const classStart = html.lastIndexOf('class="', index);
  expect(classStart).toBeGreaterThanOrEqual(0);

  const valueStart = classStart + 'class="'.length;
  const valueEnd = html.indexOf('"', valueStart);
  expect(valueEnd).toBeGreaterThan(valueStart);

  return html.slice(valueStart, valueEnd);
}

function firstClassAttribute(html: string): string {
  const match = html.match(/class="([^"]+)"/);
  expect(match?.[1]).toBeDefined();

  return match?.[1] ?? '';
}

function secondClassAttribute(html: string): string {
  const matches = [...html.matchAll(/class="([^"]+)"/g)];
  expect(matches[1]?.[1]).toBeDefined();

  return matches[1]?.[1] ?? '';
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
  it.each(['sm', 'md'] as const)(
    'matches the %s BookCard wrapper and cover footprint without exposing busy content',
    (size) => {
      const cardHtml = renderToStaticMarkup(<BookCard book={baseBook} size={size} />);
      const skeletonHtml = renderToStaticMarkup(<BookCardSkeleton size={size} />);
      const cardWrapperClass = firstClassAttribute(cardHtml);
      const skeletonWrapperClass = firstClassAttribute(skeletonHtml);
      const cardCoverClass = secondClassAttribute(cardHtml);
      const skeletonCoverClass = classAttributeFor(skeletonHtml, 'aspect-[3/4]');

      expect(skeletonWrapperClass).toBe(cardWrapperClass);
      expect(skeletonCoverClass).toContain('aspect-[3/4]');
      expect(skeletonCoverClass).toContain(size === 'sm' ? 'w-28' : 'w-36');
      expect(cardCoverClass).toContain(size === 'sm' ? 'w-28' : 'w-36');
      expect(skeletonHtml).toContain('data-testid="book-card-skeleton"');
      expect(skeletonHtml).toContain('role="status"');
      expect(skeletonHtml).toContain('aria-live="polite"');
      expect(skeletonHtml).toContain('aria-busy="true"');
      expect(skeletonHtml).toContain(
        `class="sr-only">${messages.novels.loadingSkeletonLabel}</span>`,
      );
      expect(skeletonHtml).toMatch(/<div[^>]*data-testid="book-card-skeleton"(?![^>]*aria-hidden)/);
      expect(skeletonHtml).not.toContain('href=');
    },
  );

  it('keeps animation gated behind motion-safe with an explicit reduced-motion fallback', () => {
    const html = renderToStaticMarkup(<BookCardSkeleton size="sm" />);
    const skeletonPieces = [
      classAttributeFor(html, 'aspect-[3/4]'),
      classAttributeFor(html, 'h-8'),
      classAttributeFor(html, 'h-3 w-20'),
      classAttributeFor(html, 'h-5 w-10'),
      classAttributeFor(html, 'h-5 w-12'),
      classAttributeFor(html, 'h-3 w-24'),
    ];

    expect(skeletonPieces).toHaveLength(6);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(skeletonPieces.length);
    for (const className of skeletonPieces) {
      expect(className).toContain('motion-safe:animate-pulse');
      expect(className).toContain('motion-reduce:animate-none');
      expect(className).not.toContain(' animate-pulse');
    }
  });
});
