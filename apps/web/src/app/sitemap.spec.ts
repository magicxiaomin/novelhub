import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchBooksServer } from '@/lib/server-api';
import sitemap from './sitemap';

vi.mock('@/lib/server-api', () => ({
  fetchBooksServer: vi.fn(),
}));

const fetchBooksServerMock = vi.mocked(fetchBooksServer);

describe('sitemap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('emits root, novels, and per-novel URLs from one capped bulk query', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.test/app/');
    fetchBooksServerMock.mockResolvedValue({
      items: [
        {
          id: 'book-one',
          title: 'Book One',
          author: 'A. Writer',
          coverUrl: '',
          category: 'Romance',
          tags: [],
          status: 'ongoing',
          isFeatured: true,
          totalChapters: 10,
          freeChapterCount: 3,
          coinPerChapter: 10,
        },
        {
          id: 'book two',
          title: 'Book Two',
          author: 'B. Writer',
          coverUrl: '',
          category: 'Fantasy',
          tags: [],
          status: 'completed',
          isFeatured: false,
          totalChapters: 20,
          freeChapterCount: 3,
          coinPerChapter: 10,
        },
      ],
      total: 2,
      page: 1,
      limit: 4_998,
    });

    await expect(sitemap()).resolves.toEqual([
      { url: 'https://preview.example.test/', changeFrequency: 'daily', priority: 1 },
      { url: 'https://preview.example.test/novels', changeFrequency: 'daily', priority: 0.9 },
      {
        url: 'https://preview.example.test/book/book-one',
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: 'https://preview.example.test/book/book%20two',
        changeFrequency: 'weekly',
        priority: 0.8,
      },
    ]);
    expect(fetchBooksServerMock).toHaveBeenCalledTimes(1);
    expect(fetchBooksServerMock).toHaveBeenCalledWith({ page: 1, limit: 4_998 });
  });

  it('falls back to localhost base URL and never emits more than 5000 URLs', async () => {
    fetchBooksServerMock.mockResolvedValue({
      items: Array.from({ length: 5_100 }, (_, index) => ({
        id: `book-${index + 1}`,
        title: `Book ${index + 1}`,
        author: 'A. Writer',
        coverUrl: '',
        category: 'Romance',
        tags: [],
        status: 'ongoing',
        isFeatured: false,
        totalChapters: 10,
        freeChapterCount: 3,
        coinPerChapter: 10,
      })),
      total: 5_100,
      page: 1,
      limit: 4_998,
    });

    const entries = await sitemap();

    expect(entries).toHaveLength(5_000);
    expect(entries[0]?.url).toBe('http://localhost:3000/');
    expect(entries.at(-1)?.url).toBe('http://localhost:3000/book/book-4998');
  });
});
