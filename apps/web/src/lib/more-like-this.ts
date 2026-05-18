import type { BookSummary } from './types';

export const MORE_LIKE_THIS_FETCH_LIMIT = 12;
export const MORE_LIKE_THIS_DISPLAY_LIMIT = 4;
export const MORE_LIKE_THIS_MIN_CANDIDATES = 3;

export function selectMoreLikeThisBooks(
  currentBookId: string,
  candidates: BookSummary[],
): BookSummary[] {
  const related = candidates.filter((book) => book.id !== currentBookId);
  if (related.length < MORE_LIKE_THIS_MIN_CANDIDATES) return [];
  return related.slice(0, MORE_LIKE_THIS_DISPLAY_LIMIT);
}
