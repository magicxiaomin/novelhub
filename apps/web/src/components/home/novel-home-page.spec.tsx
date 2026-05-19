import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ isLoading: true, data: undefined }),
}));

vi.mock('@/components/layout/app-shell', async () => {
  const React = await import('react');

  return {
    AppShell: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-marker': 'app-shell' }, children),
  };
});

vi.mock('@/components/home/checkin-card', async () => {
  const React = await import('react');

  return {
    CheckinCard: () => React.createElement('div', { 'data-marker': 'checkin-card' }),
  };
});

vi.mock('@/components/home/continue-reading-rail', async () => {
  const React = await import('react');

  return {
    ContinueReadingRail: () =>
      React.createElement('div', { 'data-marker': 'continue-reading-rail' }),
  };
});

vi.mock('@/components/home/featured-carousel', async () => {
  const React = await import('react');

  return {
    FeaturedCarousel: () => React.createElement('div', { 'data-marker': 'featured-carousel' }),
  };
});

vi.mock('@/components/home/book-rail', async () => {
  const React = await import('react');

  return {
    BookRail: () => React.createElement('div', { 'data-marker': 'book-rail' }),
  };
});

vi.mock('@/components/home/category-section', async () => {
  const React = await import('react');

  return {
    CategorySection: () => React.createElement('div', { 'data-marker': 'category-section' }),
  };
});

vi.mock('@/components/ui/skeleton', async () => {
  const React = await import('react');

  return {
    Skeleton: ({ className }: { className?: string }) =>
      React.createElement('div', {
        'data-marker': 'skeleton',
        'data-class': className ?? '',
      }),
  };
});

vi.mock('@/lib/queries', () => ({
  fetchBooks: vi.fn(),
  fetchCategories: vi.fn(),
  fetchFeatured: vi.fn(),
  fetchTrending: vi.fn(),
  queryKeys: {
    featured: ['featured'],
    trending: ['trending'],
    categories: ['categories'],
    list: (params: Record<string, number>) => ['books', params],
  },
}));

import { NovelHomePage } from './novel-home-page';

vi.stubGlobal('React', React);

describe('NovelHomePage loading composition', () => {
  it('renders the loading-state shell, rails, headings, and category placeholders', () => {
    const html = renderToStaticMarkup(<NovelHomePage />);

    expect(html).toContain('data-marker="app-shell"');
    expect(html).toContain('data-marker="checkin-card"');
    expect(html).toContain('data-marker="continue-reading-rail"');

    expect(html).toContain('data-class="mx-4 aspect-[16/9] rounded-2xl"');
    expect(html).toContain('Trending');
    expect(html).toContain('New Releases');

    expect(html.match(/data-class="mx-4 h-5 w-32"/g)).toHaveLength(2);
    expect(html.match(/data-marker="skeleton"/g)).toHaveLength(19);
    expect(html).not.toContain('data-marker="featured-carousel"');
    expect(html).not.toContain('data-marker="book-rail"');
    expect(html).not.toContain('data-marker="category-section"');
  });
});
