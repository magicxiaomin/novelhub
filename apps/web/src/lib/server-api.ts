/**
 * Server-side fetcher used by RSC pages (metadata + first paint).
 *
 * The browser-side `apiFetch` from `@/lib/api` reads cookies — that doesn't
 * work in a Server Component because there's no browser. For metadata
 * generation and the initial render we hit the API anonymously: the public
 * book endpoints don't require auth.
 *
 * Returns null on 404 / 401 so callers can call `notFound()` cleanly
 * instead of try/catching.
 */
import type { BookDetail } from './types';

const apiBase = (): string => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function fetchBookServer(id: string): Promise<BookDetail | null> {
  const res = await fetch(`${apiBase()}/books/${id}`, {
    // Avoid Next's default fetch caching — book detail can change as
    // chapters land. ISR could be added later if traffic warrants.
    cache: 'no-store',
  });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch book ${id}: ${res.status}`);
  }
  return (await res.json()) as BookDetail;
}
