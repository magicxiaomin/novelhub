/**
 * Deterministic fake rating per book id.
 *
 * The PRD calls for a 4.7+ random rating until real ratings exist. "Random"
 * but stable per book — so server and client render the same value (no
 * hydration mismatch) and so a book doesn't shimmer between 4.8 and 4.9 on
 * every refresh. Hash the id, scale into [4.6, 4.95], round to one decimal.
 */
const PRECISION = 10;

const hashId = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export function fakeRating(bookId: string): number {
  const slot = hashId(bookId) % 36; // 0..35 → 0.0..3.5
  const value = 4.6 + slot / 100; // 4.60..4.95
  return Math.round(value * PRECISION) / PRECISION;
}
