import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { messages } from '@novelhub/shared';
import { NovelsEmptyState } from './novels-empty-state';

function renderEmptyState(props: { hasCategoryFilter: boolean; hasStatusFilter: boolean }): string {
  return renderToStaticMarkup(<NovelsEmptyState {...props} />);
}

describe('NovelsEmptyState', () => {
  it.each([
    [
      'unfiltered catalog',
      { hasCategoryFilter: false, hasStatusFilter: false },
      messages.novels.emptyTitle,
      messages.novels.emptyBody,
      false,
    ],
    [
      'category-only filtered catalog',
      { hasCategoryFilter: true, hasStatusFilter: false },
      messages.novels.categoryOnlyEmptyTitle,
      messages.novels.categoryOnlyEmptyBody,
      true,
    ],
    [
      'status-only filtered catalog',
      { hasCategoryFilter: false, hasStatusFilter: true },
      messages.novels.statusOnlyEmptyTitle,
      messages.novels.statusOnlyEmptyBody,
      true,
    ],
    [
      'category and status filtered catalog',
      { hasCategoryFilter: true, hasStatusFilter: true },
      messages.novels.categoryAndStatusEmptyTitle,
      messages.novels.categoryAndStatusEmptyBody,
      true,
    ],
  ])('renders the %s localized variant', (_label, props, title, body, showsClearFilters) => {
    const html = renderEmptyState(props);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(title);
    expect(html).toContain(body);
    expect(html.includes(messages.novels.clearFilters)).toBe(showsClearFilters);
    expect(html.includes('href="/novels"')).toBe(showsClearFilters);
  });

  it('is server-safe and free of client-only hooks and side effects', () => {
    const html = renderEmptyState({ hasCategoryFilter: true, hasStatusFilter: true });

    expect(html).toContain(messages.novels.categoryAndStatusEmptyTitle);
  });
});
