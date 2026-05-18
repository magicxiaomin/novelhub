import { describe, expect, it, vi } from 'vitest';

import { buildReaderChapterJsonLd, buildReaderChapterMetadata } from './reader-metadata';
import type { BookDetail, ChapterResponse } from './types';

const book: BookDetail = {
  id: 'reader-book-281',
  title: 'Canonical Dawn',
  author: 'Metadata Author',
  coverUrl: 'https://cdn.example.test/covers/canonical-dawn.png',
  category: 'Fantasy',
  tags: ['portal', 'progression'],
  status: 'ongoing',
  isFeatured: false,
  totalChapters: 48,
  freeChapterCount: 3,
  coinPerChapter: 12,
  description: 'Existing book copy only.',
  chapters: [],
};

const unlockedChapter: ChapterResponse = {
  id: 'chapter-unlocked-281',
  bookId: book.id,
  chapterNumber: 2,
  title: 'Unlocked Chapter <safe>',
  isLocked: false,
  contentUrl: 'https://r2.example.test/private/chapter.txt?signature=secret',
  wordCount: 2345,
  prevChapterId: 'chapter-1',
  nextChapterId: 'chapter-3',
};

const lockedChapter: ChapterResponse = {
  id: 'chapter-locked-281',
  bookId: book.id,
  chapterNumber: 9,
  title: 'Locked Chapter',
  isLocked: true,
  preview: 'Secret preview copy that must not appear in metadata.',
  unlockOptions: {
    coinCost: 12,
    canUnlockWithCoins: true,
    canUnlockWithSubscription: true,
  },
};

describe('buildReaderChapterMetadata', () => {
  it('builds one canonical reader URL without query or trailing slash variance', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://novelhub.example/base/?ignored=1');

    const metadata = buildReaderChapterMetadata({
      book,
      chapter: unlockedChapter,
      canonicalPath: '/read/reader-book-281/2/?utm=ignored',
    });

    expect(metadata.title).toBe('Unlocked Chapter <safe>');
    expect(metadata.description).toBe('Read Unlocked Chapter <safe> on NovelHub.');
    expect(metadata.alternates).toEqual({
      canonical: 'https://novelhub.example/read/reader-book-281/2',
    });
    expect(metadata.openGraph).toMatchObject({
      title: 'Unlocked Chapter <safe>',
      description: 'Read Unlocked Chapter <safe> on NovelHub.',
      type: 'article',
      url: 'https://novelhub.example/read/reader-book-281/2',
      images: [{ url: book.coverUrl, alt: 'Cover art for Canonical Dawn' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Unlocked Chapter <safe>',
      description: 'Read Unlocked Chapter <safe> on NovelHub.',
      images: [book.coverUrl],
    });
  });

  it('uses safe existing chapter templates for locked chapters without leaking previews', () => {
    const metadata = buildReaderChapterMetadata({
      book,
      chapter: lockedChapter,
      canonicalPath: '/read/reader-book-281/9',
    });

    expect(metadata.title).toBe('Locked Chapter');
    expect(metadata.description).toBe('Read Locked Chapter on NovelHub.');
    expect(JSON.stringify(metadata)).not.toContain(lockedChapter.preview);
  });
});

describe('buildReaderChapterJsonLd', () => {
  it('emits valid bounded JSON-LD for unlocked chapters from existing fields only', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://novelhub.example');

    const jsonLd = buildReaderChapterJsonLd({
      book,
      chapter: unlockedChapter,
      canonicalPath: '/read/reader-book-281/2',
    });

    expect(JSON.parse(JSON.stringify(jsonLd))).toEqual(jsonLd);
    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Chapter',
      name: unlockedChapter.title,
      position: 2,
      url: 'https://novelhub.example/read/reader-book-281/2',
      isPartOf: {
        '@type': 'Book',
        name: book.title,
        author: { '@type': 'Person', name: book.author },
      },
      wordCount: 2345,
    });
    expect(JSON.stringify(jsonLd)).not.toContain('signature=secret');
  });

  it('emits safe locked chapter JSON-LD without preview or unlock details', () => {
    const jsonLd = buildReaderChapterJsonLd({
      book,
      chapter: lockedChapter,
      canonicalPath: '/read/reader-book-281/9',
    });

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Chapter',
      name: lockedChapter.title,
      position: 9,
      isAccessibleForFree: false,
      isPartOf: {
        '@type': 'Book',
        name: book.title,
      },
    });
    expect(JSON.stringify(jsonLd)).not.toContain(lockedChapter.preview);
    expect(JSON.stringify(jsonLd)).not.toContain('coinCost');
  });
});
