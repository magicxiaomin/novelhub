import { describe, expect, it } from 'vitest';

import { shouldRedirectToCanonicalNovelsHref } from './novels-canonical-redirect';

describe('novels canonical redirect helper', () => {
  it('returns null for an already canonical shared filter URL', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({ category: 'Werewolf', status: 'ONGOING', page: '4' }),
    ).toBeNull();
  });

  it('canonicalizes unordered incoming params to the supported novels filter order', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({
        status: 'ONGOING',
        page: '4',
        category: 'Werewolf',
      }),
    ).toBe('/novels?category=Werewolf&status=ONGOING&page=4');
  });

  it('drops page=1 because page one is represented by the bare canonical path', () => {
    expect(shouldRedirectToCanonicalNovelsHref({ page: '1' })).toBe('/novels');
  });

  it('drops empty category/status values that normalize to no filters', () => {
    expect(shouldRedirectToCanonicalNovelsHref({ category: ' ', status: '' })).toBe('/novels');
  });

  it('drops unknown query keys while preserving supported filter values', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({
        category: 'Werewolf',
        utm_source: 'facebook',
        sort: 'popular',
      }),
    ).toBe('/novels?category=Werewolf');
  });

  it('redirects array values to the canonical path because filters require single values', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({
        category: ['Werewolf', 'Fantasy'],
        status: ['ONGOING'],
        page: ['2'],
      }),
    ).toBe('/novels');
  });

  it('round-trips canonical filter hrefs without redirecting', () => {
    const canonicalCases = [
      { category: 'Werewolf' },
      { status: 'COMPLETED' },
      { page: '2' },
      { category: 'Fantasy Romance', status: 'ONGOING', page: '3' },
    ];

    canonicalCases.forEach((searchParams) => {
      expect(shouldRedirectToCanonicalNovelsHref(searchParams)).toBeNull();
    });
  });
});
