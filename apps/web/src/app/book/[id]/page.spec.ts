import { describe, expect, it, vi } from 'vitest';

import { generateMetadata } from './page';
import { fetchBookServer } from '@/lib/server-api';
import type { BookDetail } from '@/lib/types';

vi.mock('@/lib/server-api', () => ({
  fetchBookServer: vi.fn(),
  fetchRelatedBooksServer: vi.fn().mockResolvedValue([]),
}));

const mockedFetchBookServer = vi.mocked(fetchBookServer);

const book: BookDetail = {
  id: 'book-seo-264',
  title: 'Validation Moon',
  author: 'Regression Author',
  coverUrl: 'https://cdn.example.test/covers/validation-moon.png',
  category: 'Fantasy',
  tags: ['validation'],
  status: 'ongoing',
  isFeatured: false,
  totalChapters: 12,
  freeChapterCount: 3,
  coinPerChapter: 10,
  description: 'A regression novel used to pin book detail SEO previews.',
  chapters: [],
};

describe('book detail metadata', () => {
  it('uses the book payload for SEO, Open Graph, and Twitter previews', async () => {
    mockedFetchBookServer.mockResolvedValueOnce(book);

    const metadata = await generateMetadata({ params: { id: book.id } });

    expect(mockedFetchBookServer).toHaveBeenCalledWith(book.id);
    expect(metadata.title).toBe('Validation Moon — Regression Author');
    expect(metadata.description).toBe(book.description);
    expect(metadata.openGraph).toMatchObject({
      title: 'Validation Moon — Regression Author',
      description: book.description,
      type: 'book',
      images: [{ url: book.coverUrl, alt: 'Cover art for Validation Moon' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Validation Moon — Regression Author',
      description: book.description,
      images: [book.coverUrl],
    });
  });
});
