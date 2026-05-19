import { describe, expect, it } from 'vitest';
import { messages } from '@novelhub/shared';

import {
  buildNovelsHref,
  parseNovelsFilters,
  serializeNovelsFilters,
  statusFilterOptions,
  toBooksListQuery,
  type NovelsSearchParams,
} from './novels-filters';

describe('novels filters', () => {
  it('keeps only category, status, and valid page from URL search params', () => {
    const filters = parseNovelsFilters({
      category: 'Werewolf',
      status: 'COMPLETED',
      page: '3',
      sort: 'recently-updated',
      length: 'long',
    } as NovelsSearchParams & { sort: string; length: string });

    expect(filters).toEqual({ category: 'Werewolf', status: 'COMPLETED', page: 3 });
  });

  it('drops unsupported status values and invalid pages', () => {
    expect(parseNovelsFilters({ status: 'DRAFT', page: '0' })).toEqual({});
    expect(parseNovelsFilters({ status: ['ONGOING', 'COMPLETED'], page: 'abc' })).toEqual({});
    expect(parseNovelsFilters({ status: '', page: '' })).toEqual({});
    expect(parseNovelsFilters({ status: 'ongoing', page: '1' })).toEqual({});
  });

  it('drops repeated array params before parsing category, status, or page', () => {
    expect(
      parseNovelsFilters({
        category: ['Werewolf', 'Billionaire'],
        status: ['ONGOING', 'COMPLETED'],
        page: ['2', '3'],
      }),
    ).toEqual({});
  });

  it('normalizes whitespace-only categories to the bare novels path', () => {
    expect(parseNovelsFilters({ category: ' \t\n ' })).toEqual({});
    expect(serializeNovelsFilters(parseNovelsFilters({ category: ' \t\n ' }))).toBe('/novels');
  });

  it('round-trips special-character categories through URLSearchParams encoding', () => {
    const params = new URLSearchParams();
    params.set('category', 'Sci-Fi & Fantasy/王');
    params.set('status', 'ONGOING');
    params.set('page', '2');

    const filters = parseNovelsFilters({
      category: params.get('category') ?? undefined,
      status: params.get('status') ?? undefined,
      page: params.get('page') ?? undefined,
    });

    expect(filters).toEqual({ category: 'Sci-Fi & Fantasy/王', status: 'ONGOING', page: 2 });
    expect(serializeNovelsFilters(filters)).toBe(
      '/novels?category=Sci-Fi+%26+Fantasy%2F%E7%8E%8B&status=ONGOING&page=2',
    );
  });

  it('normalizes malformed and out-of-range page values to the first page', () => {
    expect(parseNovelsFilters({ page: '-2' })).toEqual({});
    expect(parseNovelsFilters({ page: '1.5' })).toEqual({});
    expect(parseNovelsFilters({ page: '999999999999' })).toEqual({});
    expect(parseNovelsFilters({ page: '1000' })).toEqual({ page: 1000 });
    expect(parseNovelsFilters({ page: '1001' })).toEqual({});
  });

  it('builds filter hrefs with page reset when category or status changes', () => {
    const current = { category: 'Werewolf', status: 'ONGOING' as const, page: 4 };

    expect(buildNovelsHref(current, { category: 'Billionaire' })).toBe(
      '/novels?category=Billionaire&status=ONGOING',
    );
    expect(buildNovelsHref(current, { status: 'COMPLETED' })).toBe(
      '/novels?category=Werewolf&status=COMPLETED',
    );
  });

  it('supports explicit page hrefs and clear-filter hrefs', () => {
    const current = { category: 'Werewolf', status: 'ONGOING' as const, page: 2 };

    expect(buildNovelsHref(current, { page: 3 })).toBe(
      '/novels?category=Werewolf&status=ONGOING&page=3',
    );
    expect(buildNovelsHref(current, { category: undefined })).toBe('/novels?status=ONGOING');
    expect(
      buildNovelsHref(current, { category: undefined, status: undefined, page: undefined }),
    ).toBe('/novels');
  });

  it('omits first page and out-of-range page href values', () => {
    const current = { category: 'ROMANCE', status: 'COMPLETED' as const, page: 2 };

    expect(buildNovelsHref(current, { page: 1 })).toBe('/novels?category=ROMANCE&status=COMPLETED');
    expect(buildNovelsHref(current, { page: 0 })).toBe('/novels?category=ROMANCE&status=COMPLETED');
    expect(buildNovelsHref(current, { page: 999999999999 })).toBe(
      '/novels?category=ROMANCE&status=COMPLETED',
    );
  });

  it('serializes parsed filters in deterministic shareable URL order', () => {
    const searchParams = {
      status: 'COMPLETED',
      page: '3',
      category: 'Royal Romance',
      utm_source: 'facebook',
    } as NovelsSearchParams & { utm_source: string };

    expect(serializeNovelsFilters(parseNovelsFilters(searchParams))).toBe(
      '/novels?category=Royal+Romance&status=COMPLETED&page=3',
    );
  });

  it('serializes unknown, empty, and first-page filters to the bare novels path', () => {
    const searchParams = {
      category: '   ',
      status: 'DRAFT',
      page: '1',
      sort: 'recently-updated',
    } as NovelsSearchParams & { sort: string };

    expect(serializeNovelsFilters(parseNovelsFilters(searchParams))).toBe('/novels');
  });

  it('documents the status filter values sent to the worker books contract', () => {
    expect(statusFilterOptions.map((option) => option.value)).toEqual(['ONGOING', 'COMPLETED']);
    expect(statusFilterOptions.map((option) => option.label)).toEqual([
      messages.novels.statusOngoing,
      messages.novels.statusCompleted,
    ]);
  });

  it('adapts URL filters to the worker books list query without unsupported filters', () => {
    const query = toBooksListQuery({ category: 'Werewolf', status: 'ONGOING', page: 3 }, 20);

    expect(query).toEqual({ category: 'Werewolf', status: 'ONGOING', page: 3, limit: 20 });
    expect(Object.keys(query)).toEqual(['category', 'status', 'page', 'limit']);
    expect(query).not.toHaveProperty('sort');
    expect(query).not.toHaveProperty('length');
    expect(query).not.toHaveProperty('recentlyUpdated');
    expect(query).not.toHaveProperty('featured');
  });

  it('adapts empty URL filters to the first worker books list page', () => {
    expect(toBooksListQuery({}, 12)).toEqual({ page: 1, limit: 12 });
  });
});
