import { describe, expect, it } from 'vitest';

import { buildBookDetailMetadata } from './book-metadata';
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
  it('uses the book title, author, description, and cover image for Open Graph previews', () => {
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
  });

  it('falls back to safe site metadata and a raster preview when description and cover are missing', () => {
    const metadata = buildBookDetailMetadata({
      ...baseBook,
      coverUrl: '',
      description: '   ',
    });

    expect(metadata.description).toBe(
      'Discover serialized web novels, read free chapters, and unlock more with coins or a subscription.',
    );
    expect(metadata.openGraph).toMatchObject({
      description:
        'Discover serialized web novels, read free chapters, and unlock more with coins or a subscription.',
      images: [
        {
          url: '/og-default.png',
          alt: 'NovelHub — Read Addictive Web Novels',
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
