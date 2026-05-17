import { buildBookDescription, resolveBookCoverImage } from './book-metadata';
import type { BookDetail } from './types';

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export type BookJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Book';
  name: string;
  author: { '@type': 'Person'; name: string };
  image: string;
  description: string;
  genre: string;
  keywords?: string;
  bookFormat: 'https://schema.org/EBook';
  numberOfPages: number;
  aggregateRating: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: string;
    bestRating: string;
  };
};

export function buildBookJsonLd(book: BookDetail, rating: number): BookJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    image: resolveBookCoverImage(book),
    description: buildBookDescription(book),
    genre: book.category,
    ...(book.tags.length ? { keywords: book.tags.join(', ') } : {}),
    bookFormat: 'https://schema.org/EBook',
    numberOfPages: book.totalChapters,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: rating.toFixed(1),
      reviewCount: '1',
      bestRating: '5',
    },
  };
}
