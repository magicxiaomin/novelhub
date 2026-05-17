import { describe, expect, it } from 'vitest';

import {
  buildBookDetailMetadata,
  resolveBookCoverImage,
  SITE_DEFAULT_BOOK_COVER,
} from './book-metadata';
import type { BookDetail } from './types';

const baseBook: BookDetail = {
  id: 'book-1',
  title: 'Moonlit Contract',
  author: 'A. Writer',
  coverUrl: 'https://cdn.example.com/covers/moonlit.jpg',
  category: 'Romance',
  tags: ['werewolf'],
  status: 'ongoing',
  isFeatured: false,
  totalChapters: 88,
  freeChapterCount: 3,
  coinPerChapter: 10,
  description: 'A forbidden romance with enough twists to hook ad traffic previews.',
  chapters: [],
};

describe('buildBookDetailMetadata', () => {
  it('uses the book title, author, description, and cover image for Open Graph and Twitter previews', () => {
    const metadata = buildBookDetailMetadata(baseBook);

    expect(metadata.title).toBe('Moonlit Contract — A. Writer');
    expect(metadata.description).toBe(baseBook.description);
    expect(metadata.openGraph).toMatchObject({
      title: 'Moonlit Contract — A. Writer',
      description: baseBook.description,
      type: 'book',
      images: [
        {
          url: baseBook.coverUrl,
          alt: 'Cover art for Moonlit Contract',
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Moonlit Contract — A. Writer',
      description: baseBook.description,
      images: [baseBook.coverUrl],
    });
  });

  it('falls back to a category cover before the site default when the book cover is missing', () => {
    const metadata = buildBookDetailMetadata({
      ...baseBook,
      coverUrl: '   ',
      description: '   ',
    });

    expect(resolveBookCoverImage({ ...baseBook, coverUrl: '   ' })).toBe('/og/romance-book.png');
    expect(metadata.description).toBe(
      'Discover serialized web novels, read free chapters, and unlock more with coins or a subscription.',
    );
    expect(metadata.openGraph).toMatchObject({
      description:
        'Discover serialized web novels, read free chapters, and unlock more with coins or a subscription.',
      images: [
        {
          url: '/og/romance-book.png',
          alt: 'Cover art for Moonlit Contract',
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      images: ['/og/romance-book.png'],
    });
  });

  it('uses the site default cover when neither book nor category cover is available', () => {
    const metadata = buildBookDetailMetadata({
      ...baseBook,
      category: 'Experimental LitRPG',
      coverUrl: '',
    });

    expect(
      resolveBookCoverImage({ ...baseBook, category: 'Experimental LitRPG', coverUrl: '' }),
    ).toBe(SITE_DEFAULT_BOOK_COVER);
    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: SITE_DEFAULT_BOOK_COVER,
          alt: 'Cover art for Moonlit Contract',
        },
      ],
    });
  });

  it('builds the cover alt from shared message copy', () => {
    const metadata = buildBookDetailMetadata({
      ...baseBook,
      title: 'Dragon Heir',
      coverUrl: 'https://cdn.example.com/covers/dragon.jpg',
    });

    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: 'https://cdn.example.com/covers/dragon.jpg',
          alt: 'Cover art for Dragon Heir',
        },
      ],
    });
  });
});
