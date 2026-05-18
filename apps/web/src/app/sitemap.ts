import type { MetadataRoute } from 'next';

import { fetchBooksServer } from '@/lib/server-api';
import { absoluteAppUrl } from '@/lib/site-url';

export const runtime = 'edge';

const maxSitemapUrls = 5_000;
const staticUrlCount = 2;
const maxNovelUrls = maxSitemapUrls - staticUrlCount;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await fetchBooksServer({ page: 1, limit: maxNovelUrls });
  const novelEntries = books.items.slice(0, maxNovelUrls).map((book) => ({
    url: absoluteAppUrl(`/book/${encodeURIComponent(book.id)}`),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    { url: absoluteAppUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteAppUrl('/novels'), changeFrequency: 'daily', priority: 0.9 },
    ...novelEntries,
  ];
}
