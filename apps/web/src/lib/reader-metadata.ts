import type { Metadata } from 'next';

import { messages } from '@novelhub/shared';

import { resolveBookCoverImage } from './book-metadata';
import { absoluteAppUrl } from './site-url';
import type { BookDetail, ChapterResponse } from './types';

type ReaderChapterForMetadata = Pick<ChapterResponse, 'title' | 'chapterNumber'> & {
  wordCount?: number;
};

type ReaderChapterMetadataInput = {
  book: Pick<BookDetail, 'title' | 'author' | 'coverUrl' | 'category'>;
  chapter: ReaderChapterForMetadata;
  canonicalPath: string;
};

export type ReaderChapterJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Chapter';
  name: string;
  position: number;
  url: string;
  isPartOf: {
    '@type': 'Book';
    name: string;
    author: { '@type': 'Person'; name: string };
  };
  wordCount?: number;
  isAccessibleForFree?: false;
};

export function buildReaderChapterMetadata({
  book,
  chapter,
  canonicalPath,
}: ReaderChapterMetadataInput): Metadata {
  const description = messages.reader.chapterDescription.split('{title}').join(chapter.title);
  const canonicalUrl = canonicalReaderUrl(canonicalPath);
  const imageUrl = resolveBookCoverImage(book);
  const image = {
    url: imageUrl,
    alt: messages.metadata.coverAltTemplate.replace('{bookTitle}', book.title),
  };

  return {
    title: chapter.title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: chapter.title,
      description,
      url: canonicalUrl,
      images: [image],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: chapter.title,
      description,
      images: [imageUrl],
    },
  };
}

export function buildReaderChapterJsonLd({
  book,
  chapter,
  canonicalPath,
}: ReaderChapterMetadataInput): ReaderChapterJsonLd {
  const chapterProperties =
    'wordCount' in chapter
      ? { wordCount: chapter.wordCount }
      : { isAccessibleForFree: false as const };

  return {
    '@context': 'https://schema.org',
    '@type': 'Chapter',
    name: chapter.title,
    position: chapter.chapterNumber,
    url: canonicalReaderUrl(canonicalPath),
    isPartOf: {
      '@type': 'Book',
      name: book.title,
      author: { '@type': 'Person', name: book.author },
    },
    ...chapterProperties,
  };
}

export function canonicalReaderUrl(path: string): string {
  const parsed = new URL(path, 'http://reader.local');
  return absoluteAppUrl(parsed.pathname.replace(/\/+$/, ''));
}
