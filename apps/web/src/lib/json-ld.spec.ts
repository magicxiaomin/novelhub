import { describe, expect, it } from 'vitest';

import { resolveBookCoverImage } from './book-metadata';
import { buildBookJsonLd, safeJsonLd } from './json-ld';
import type { BookDetail } from './types';

const book: BookDetail = {
  id: 'book-1',
  title: 'Moonlit Contract',
  author: 'A. Writer',
  coverUrl: 'https://cdn.example.com/covers/moonlit.jpg',
  category: 'Romance',
  tags: ['werewolf', 'fated mates'],
  status: 'ongoing',
  isFeatured: false,
  totalChapters: 88,
  freeChapterCount: 3,
  coinPerChapter: 10,
  description: 'A forbidden romance with enough twists to hook ad traffic previews.',
  chapters: [],
};

describe('safeJsonLd', () => {
  it('escapes script-breaking HTML metacharacters', () => {
    expect(safeJsonLd({ title: '</script><script>alert(1)</script>&' })).toBe(
      '{"title":"\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e\\u0026"}',
    );
  });

  it('escapes line and paragraph separators for script context', () => {
    expect(safeJsonLd({ text: 'line\u2028paragraph\u2029' })).toBe(
      '{"text":"line\\u2028paragraph\\u2029"}',
    );
  });
});

describe('buildBookJsonLd', () => {
  it('emits valid Book JSON-LD with the resolved book cover', () => {
    expect(buildBookJsonLd(book, 4.7)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: 'Moonlit Contract',
      author: { '@type': 'Person', name: 'A. Writer' },
      image: resolveBookCoverImage(book),
      description: book.description,
      genre: 'Romance',
      keywords: 'werewolf, fated mates',
      bookFormat: 'https://schema.org/EBook',
      numberOfPages: 88,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.7',
        reviewCount: '1',
        bestRating: '5',
      },
    });
  });

  it('uses the shared cover fallback chain for JSON-LD image', () => {
    const missingCoverBook = { ...book, coverUrl: '', category: 'Experimental LitRPG' };

    expect(buildBookJsonLd(missingCoverBook, 4.2)).toMatchObject({
      '@type': 'Book',
      image: resolveBookCoverImage(missingCoverBook),
    });
  });
});
