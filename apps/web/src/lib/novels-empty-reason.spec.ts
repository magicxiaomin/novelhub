import { describe, expect, it } from 'vitest';

import {
  buildNovelsEmptyReasonEvent,
  deriveNovelsEmptyReason,
  type NovelsEmptyReasonEvent,
} from './novels-empty-reason';

describe('deriveNovelsEmptyReason', () => {
  it.each([
    [{ hasCategoryFilter: false, hasStatusFilter: false }, 'unfiltered'],
    [{ hasCategoryFilter: true, hasStatusFilter: false }, 'categoryOnly'],
    [{ hasCategoryFilter: false, hasStatusFilter: true }, 'statusOnly'],
    [{ hasCategoryFilter: true, hasStatusFilter: true }, 'categoryAndStatus'],
  ] as const)('derives %s as %s', (filters, expectedReason) => {
    expect(deriveNovelsEmptyReason(filters)).toBe(expectedReason);
  });
});

describe('buildNovelsEmptyReasonEvent', () => {
  it('builds the privacy-safe payload from booleans only', () => {
    const event = buildNovelsEmptyReasonEvent({
      hasCategoryFilter: true,
      hasStatusFilter: false,
      timestamp: 1779410000000,
    });

    expect(event).toEqual({
      surface: 'novels-list',
      routePattern: '/novels',
      reason: 'categoryOnly',
      filters: { category: true, status: false },
      timestamp: 1779410000000,
    });
  });

  it('defaults timestamp to the current epoch milliseconds without changing payload keys', () => {
    const before = Date.now();
    const event = buildNovelsEmptyReasonEvent({
      hasCategoryFilter: false,
      hasStatusFilter: true,
    });
    const after = Date.now();

    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
    expect(Object.keys(event).sort()).toEqual([
      'filters',
      'reason',
      'routePattern',
      'surface',
      'timestamp',
    ]);
    expect(Object.keys(event.filters).sort()).toEqual(['category', 'status']);
  });

  it('exposes exact literal event types with no route or raw filter value fields', () => {
    const event: NovelsEmptyReasonEvent = buildNovelsEmptyReasonEvent({
      hasCategoryFilter: true,
      hasStatusFilter: true,
      timestamp: 1,
    });
    const serialized = JSON.stringify(event);

    expect(event.surface).toBe('novels-list');
    expect(event.routePattern).toBe('/novels');
    expect(event.reason).toBe('categoryAndStatus');
    expect(serialized).not.toContain('Werewolf');
    expect(serialized).not.toContain('ONGOING');
    expect(serialized).not.toContain('slug');
    expect(serialized).not.toContain('bookId');
    expect('route' in event).toBe(false);
  });
});
