import { describe, expect, it } from 'vitest';

import { fakeRating } from './fake-rating';

describe('fakeRating', () => {
  it('returns a number in [4.7, 4.95]', () => {
    for (const id of ['a', 'book-123', 'd2e1c0fa-aaaa-4bbb-8ccc-1234567890ab']) {
      const r = fakeRating(id);
      expect(r).toBeGreaterThanOrEqual(4.7);
      expect(r).toBeLessThanOrEqual(4.95);
    }
  });

  it('is deterministic per id (no SSR/CSR mismatch)', () => {
    const id = 'd2e1c0fa-aaaa-4bbb-8ccc-1234567890ab';
    expect(fakeRating(id)).toBe(fakeRating(id));
  });

  it('is not constant — different ids can produce different values', () => {
    // Sequential `id-N` strings are too similar for FNV-1a to spread far,
    // so this just guards against a constant return value (the bug we'd
    // actually catch is "fakeRating always returns 4.7").
    const seen = new Set<number>();
    for (let i = 0; i < 200; i += 1) seen.add(fakeRating(`book-${i}-${i * 7}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
