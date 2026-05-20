import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookSummary, CategoryCount } from '@/lib/types';

const queryState = vi.hoisted(() => ({
  featured: { isLoading: true, data: undefined as BookSummary[] | undefined },
  trending: { isLoading: true, data: undefined as BookSummary[] | undefined },
  categories: { isLoading: true, data: undefined as CategoryCount[] | undefined },
  newReleases: {
    isLoading: true,
    data: undefined as { items: BookSummary[] } | undefined,
  },
}));

const railPropsSpy = vi.hoisted(() => vi.fn());
const featuredPropsSpy = vi.hoisted(() => vi.fn());
const categoryPropsSpy = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const key = queryKey[0];
    if (key === 'featured') return queryState.featured;
    if (key === 'trending') return queryState.trending;
    if (key === 'categories') return queryState.categories;
    return queryState.newReleases;
  },
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
    FeaturedCarousel: (props: { books: BookSummary[] }) => {
      featuredPropsSpy(props);
      return React.createElement('div', { 'data-marker': 'featured-carousel' });
    },
  };
});

vi.mock('@/components/home/book-rail', async () => {
  const React = await import('react');

  return {
    BookRail: (props: { title: string; books: BookSummary[]; seeAllHref?: string }) => {
      railPropsSpy(props);
      return React.createElement(
        'section',
        { 'data-marker': 'book-rail', 'data-see-all-href': props.seeAllHref ?? '' },
        props.books.map((book) =>
          React.createElement('a', { key: book.id, href: `/book/${book.id}` }, book.title),
        ),
      );
    },
  };
});

vi.mock('@/components/home/category-section', async () => {
  const React = await import('react');

  return {
    CategorySection: ({ category }: { category: string }) => {
      categoryPropsSpy({ category });
      return React.createElement(
        'a',
        {
          'data-marker': 'category-section',
          href: `/novels?category=${encodeURIComponent(category)}`,
        },
        category,
      );
    },
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

const book = (id: string, category = 'Fantasy'): BookSummary => ({
  id,
  title: `Book ${id}`,
  author: 'NovelHub',
  coverUrl: `/covers/${id}.png`,
  category,
  tags: [],
  status: 'ongoing',
  isFeatured: false,
  totalChapters: 12,
  freeChapterCount: 3,
  coinPerChapter: 10,
});

beforeEach(() => {
  vi.clearAllMocks();
  queryState.featured = { isLoading: true, data: undefined };
  queryState.trending = { isLoading: true, data: undefined };
  queryState.categories = { isLoading: true, data: undefined };
  queryState.newReleases = { isLoading: true, data: undefined };
});

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

describe('NovelHomePage novels entry handoffs', () => {
  it('hands featured, trending, and new release book ids to current /book detail links', () => {
    queryState.featured = { isLoading: false, data: [book('featured-entry')] };
    queryState.trending = { isLoading: false, data: [book('trending-entry')] };
    queryState.newReleases = { isLoading: false, data: { items: [book('new-release-entry')] } };
    queryState.categories = { isLoading: false, data: [] };

    const html = renderToStaticMarkup(<NovelHomePage />);

    expect(featuredPropsSpy).toHaveBeenCalledWith({ books: [book('featured-entry')] });
    expect(railPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        books: [book('trending-entry')],
        seeAllHref: '/novels',
        title: 'Trending',
      }),
    );
    expect(railPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        books: [book('new-release-entry')],
        seeAllHref: '/novels',
        title: 'New Releases',
      }),
    );
    expect(html).toContain('href="/book/trending-entry"');
    expect(html).toContain('href="/book/new-release-entry"');
    expect(html).toContain('data-see-all-href="/novels"');
    expect(html).not.toContain('novelId=');
  });

  it('hands category sections the current category names for /novels category links', () => {
    queryState.featured = { isLoading: false, data: [] };
    queryState.trending = { isLoading: false, data: [] };
    queryState.newReleases = { isLoading: false, data: { items: [] } };
    queryState.categories = {
      isLoading: false,
      data: [
        { category: 'Urban Fantasy', count: 4 },
        { category: 'Sci-Fi & Space', count: 2 },
      ],
    };

    const html = renderToStaticMarkup(<NovelHomePage />);

    expect(categoryPropsSpy).toHaveBeenCalledWith({ category: 'Urban Fantasy' });
    expect(categoryPropsSpy).toHaveBeenCalledWith({ category: 'Sci-Fi & Space' });
    expect(html).toContain('href="/novels?category=Urban%20Fantasy"');
    expect(html).toContain('href="/novels?category=Sci-Fi%20%26%20Space"');
    expect(html).not.toContain('/drama');
  });
});
