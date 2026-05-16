import type { Metadata } from 'next';

import { messages } from '@novelhub/shared';

import type { BookDetail } from './types';

const DEFAULT_OG_IMAGE = '/og-default.png';
const MAX_DESCRIPTION_LENGTH = 160;

const bookTitle = (book: Pick<BookDetail, 'title' | 'author'>): string =>
  `${book.title} — ${book.author}`;

const truncateDescription = (description: string): string => {
  if (description.length <= MAX_DESCRIPTION_LENGTH) return description;
  return description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
};

const coverAlt = (bookTitle: string): string =>
  messages.metadata.coverAltTemplate.replace('{bookTitle}', bookTitle);

export const buildBookDetailMetadata = (book: BookDetail): Metadata => {
  const title = bookTitle(book);
  const trimmedDescription = book.description.trim();
  const description = trimmedDescription
    ? truncateDescription(trimmedDescription)
    : messages.metadata.description;
  const coverUrl = book.coverUrl.trim();
  const image = coverUrl
    ? { url: coverUrl, alt: coverAlt(book.title) }
    : { url: DEFAULT_OG_IMAGE, alt: messages.metadata.title };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
      type: 'book',
    },
  };
};
