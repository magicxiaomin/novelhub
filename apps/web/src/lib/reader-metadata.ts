import type { Metadata } from 'next';

import { messages } from '@novelhub/shared';

import { absoluteAppUrl } from './site-url';
import type { BookDetail, ChapterResponse } from './types';

type ReaderChapterMetadataInput = {
  book: Pick<BookDetail, 'title' | 'author'>;
  chapter: ChapterResponse;
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
  chapter,
  canonicalPath,
}: ReaderChapterMetadataInput): Metadata {
  const description = messages.reader.chapterDescription.split('{title}').join(chapter.title);

  return {
    title: chapter.title,
    description,
    alternates: {
      canonical: canonicalReaderUrl(canonicalPath),
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
