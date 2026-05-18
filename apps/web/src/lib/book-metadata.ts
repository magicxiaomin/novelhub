import type { Metadata } from 'next';

import { messages } from '@novelhub/shared';

import { absoluteAppUrl } from './site-url';
import type { BookDetail } from './types';

export const SITE_DEFAULT_BOOK_COVER = '/og-default.png';

const CATEGORY_DEFAULT_BOOK_COVERS: Record<string, string> = {
  romance: '/og/romance-book.png',
  fantasy: '/og/fantasy-book.png',
  mystery: '/og/mystery-book.png',
  thriller: '/og/thriller-book.png',
  'science fiction': '/og/scifi-book.png',
  scifi: '/og/scifi-book.png',
};

const MAX_DESCRIPTION_LENGTH = 160;

const bookTitle = (book: Pick<BookDetail, 'title' | 'author'>): string =>
  `${book.title} — ${book.author}`;

const truncateDescription = (description: string): string => {
  if (description.length <= MAX_DESCRIPTION_LENGTH) return description;
  return description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
};

const coverAlt = (bookTitle: string): string =>
  messages.metadata.coverAltTemplate.replace('{bookTitle}', bookTitle);

export const resolveBookCoverImage = (book: Pick<BookDetail, 'coverUrl' | 'category'>): string => {
  const coverUrl = book.coverUrl.trim();
  if (coverUrl) return coverUrl;

  return (
    CATEGORY_DEFAULT_BOOK_COVERS[book.category.trim().toLowerCase()] ?? SITE_DEFAULT_BOOK_COVER
  );
};

export const buildBookDescription = (book: Pick<BookDetail, 'description'>): string => {
  const trimmedDescription = book.description.trim();
  return trimmedDescription
    ? truncateDescription(trimmedDescription)
    : messages.metadata.description;
};

export const buildBookDetailMetadata = (book: BookDetail): Metadata => {
  const title = bookTitle(book);
  const description = buildBookDescription(book);
  const imageUrl = resolveBookCoverImage(book);
  const image = { url: imageUrl, alt: coverAlt(book.title) };
  const canonicalUrl = absoluteAppUrl(`/book/${encodeURIComponent(book.id)}`);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [image],
      type: 'book',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
};
