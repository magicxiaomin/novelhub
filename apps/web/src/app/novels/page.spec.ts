import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NovelsPage, { generateMetadata } from './page';
import {
  buildCanonicalNovelsAffordance,
  shouldShowCanonicalNovelsAffordance,
} from './canonical-affordance';
import { shouldRedirectToCanonicalNovelsHref } from '@/lib/novels-canonical-redirect';
import { messages } from '@novelhub/shared';
import { fetchBookCategoriesServer, fetchBooksServer } from '@/lib/server-api';
import type { BookSummary } from '@/lib/types';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-marker': 'app-shell' }, children),
}));

vi.mock('@/components/book/book-card', () => ({
  BookCard: ({ book }: { book: BookSummary }) =>
    React.createElement('a', { href: `/book/${book.id}`, 'data-marker': 'book-card' }, book.title),
}));

vi.mock('@/lib/server-api', () => ({
  fetchBooksServer: vi.fn(),
  fetchBookCategoriesServer: vi.fn(),
}));

const mockedFetchBooksServer = vi.mocked(fetchBooksServer);
const mockedFetchBookCategoriesServer = vi.mocked(fetchBookCategoriesServer);

const listedBook = (id: string, category = 'Fantasy'): BookSummary => ({
  id,
  title: `Listed ${id}`,
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
  vi.stubGlobal('React', React);
  mockedFetchBooksServer.mockResolvedValue({
    items: [listedBook('entry-book')],
    total: 1,
    page: 1,
    limit: 20,
  });
  mockedFetchBookCategoriesServer.mockResolvedValue([
    { category: 'Urban Fantasy', count: 4 },
    { category: 'Sci-Fi & Space', count: 2 },
  ]);
});

const novelsRouteDir = join(process.cwd(), 'src/app/novels');

function readNovelsRouteFile(path: string): string {
  return readFileSync(join(novelsRouteDir, path), 'utf8');
}

describe('novels page metadata', () => {
  it('keeps unfiltered discovery indexable without forcing robots metadata', async () => {
    const metadata = await generateMetadata({ searchParams: {} });

    expect(metadata.title).toBe(messages.metadata.novels.title);
    expect(metadata.description).toBe(messages.metadata.novels.description);
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates).toMatchObject({ canonical: '/novels' });
    expect(metadata.openGraph).toMatchObject({
      title: messages.metadata.novels.title,
      description: messages.metadata.novels.description,
      type: 'website',
      images: [{ url: '/og/novels.png', alt: messages.metadata.novels.ogAlt }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: messages.metadata.novels.title,
      description: messages.metadata.novels.description,
      images: ['/og/novels.png'],
    });
  });

  it('marks category-filtered discovery as noindex with the /novels canonical', async () => {
    const metadata = await generateMetadata({ searchParams: { category: 'Werewolf' } });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates).toMatchObject({ canonical: '/novels' });
  });

  it('marks status-filtered discovery as noindex with the /novels canonical', async () => {
    const metadata = await generateMetadata({ searchParams: { status: 'ONGOING' } });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates).toMatchObject({ canonical: '/novels' });
  });

  it('marks paginated discovery after page one as noindex with the /novels canonical', async () => {
    const metadata = await generateMetadata({ searchParams: { page: '2' } });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates).toMatchObject({ canonical: '/novels' });
  });
});

describe('novels canonical affordance', () => {
  it.each([
    ['category-filtered views', { category: 'Werewolf' }],
    ['status-filtered views', { status: 'ONGOING' }],
    ['page-only paginated views', { page: '2' }],
  ])('shows on %s', (_label, searchParams) => {
    expect(shouldShowCanonicalNovelsAffordance(searchParams)).toBe(true);
    expect(buildCanonicalNovelsAffordance(searchParams)).toEqual({
      href: '/novels',
      label: messages.novels.filteredViewCanonicalCta,
    });
  });

  it('does not show on the unfiltered canonical novels view', () => {
    expect(shouldShowCanonicalNovelsAffordance({})).toBe(false);
    expect(buildCanonicalNovelsAffordance({})).toBeNull();
  });

  it('requests a canonical URL redirect when incoming filter params are unordered or unknown', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({
        status: 'ONGOING',
        page: '4',
        category: 'Werewolf',
        utm_source: 'facebook',
      } as Record<string, string>),
    ).toBe('/novels?category=Werewolf&status=ONGOING&page=4');
  });

  it('requests a bare-path redirect when incoming filters normalize to empty', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({
        category: ' ',
        status: 'DRAFT',
        page: '1',
      }),
    ).toBe('/novels');
  });

  it('does not redirect an already canonical shared filter URL', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({ category: 'Werewolf', status: 'ONGOING', page: '4' }),
    ).toBeNull();
  });
});

describe('novels route polish', () => {
  it('keeps filtered-zero state distinct, actionable, and announced politely', () => {
    const source = readNovelsRouteFile('page.tsx');

    expect(messages.novels.categoryOnlyEmptyTitle).toBe('No novels match this category');
    expect(messages.novels.statusOnlyEmptyTitle).toBe('No novels match this status');
    expect(messages.novels.categoryAndStatusEmptyTitle).toBe('No novels match these filters');
    expect(messages.novels.categoryAndStatusEmptyBody).toContain('Try clearing filters');
    expect(messages.novels.categoryAndStatusEmptyTitle).not.toBe(messages.novels.emptyTitle);
    expect(messages.novels.categoryAndStatusEmptyBody).not.toBe(messages.novels.emptyBody);
    expect(source).toContain('NovelsEmptyState');
    expect(source).toContain('hasCategoryFilter={hasCategoryFilter}');
    expect(source).toContain('hasStatusFilter={hasStatusFilter}');
  });

  it('keeps the truly-empty catalog state free of misleading filter reset copy', () => {
    const source = readNovelsRouteFile('page.tsx');

    expect(messages.novels.emptyTitle).toBe('No novels are available yet');
    expect(messages.novels.emptyBody).toContain('New stories are coming soon');
    expect(messages.novels.emptyBody).not.toContain('filter');
    expect(messages.novels.emptyBody).not.toContain('Clear filters');
    expect(source).toContain('hasCategoryFilter={hasCategoryFilter}');
    expect(source).toContain('hasStatusFilter={hasStatusFilter}');
  });

  it('adds a retryable novels route error boundary that returns to novels', () => {
    const source = readNovelsRouteFile('error.tsx');

    expect(messages.errors.novelsRouteError).toBe('Novels could not be loaded');
    expect(messages.errors.novelsRouteErrorBody).toContain('Try again');
    expect(source).toMatch(/^'use client';/);
    expect(source).toContain('reset');
    expect(source).toContain('messages.errors.routeBoundaryReset');
    expect(source).toContain('messages.errors.novelsRouteError');
    expect(source).toContain('messages.errors.novelsRouteErrorBody');
    expect(source).toContain('href="/novels"');
    expect(source).not.toContain('href="/"');
  });

  it('uses BookCardSkeleton in the route loading state to reserve card footprint', () => {
    const source = readNovelsRouteFile('loading.tsx');

    expect(source).toContain('BookCardSkeleton');
    expect(source).toContain('Array.from({ length: 8 })');
    expect(source).toContain('aria-label={messages.novels.loadingSkeletonLabel}');
  });
});

describe('novels page entry handoffs', () => {
  it('drops acquisition query context at the novels canonical redirect instead of preserving it', () => {
    expect(
      shouldRedirectToCanonicalNovelsHref({
        utm_source: 'facebook',
        utm_medium: 'paid_social',
        utm_campaign: 'spring_launch',
        fbclid: 'fb-click-id',
      }),
    ).toBe('/novels');
  });

  it('renders existing book-card /book detail handoffs without an ad redirect or novelId parser', async () => {
    const html = renderToStaticMarkup(await NovelsPage({ searchParams: {} }));

    expect(mockedFetchBooksServer).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(html).toContain('data-marker="book-card"');
    expect(html).toContain('href="/book/entry-book"');
    expect(html).not.toContain('utm_source=');
    expect(html).not.toContain('fbclid=');
    expect(html).not.toContain('novelId=');
    expect(html).not.toContain('/drama');
  });

  it('uses current /novels category filter links for discovery handoff', async () => {
    const html = renderToStaticMarkup(await NovelsPage({ searchParams: {} }));

    expect(html).toContain('href="/novels?category=Urban+Fantasy"');
    expect(html).toContain('href="/novels?category=Sci-Fi+%26+Space"');
    expect(html).toContain('href="/novels?status=ONGOING"');
    expect(html).not.toContain('/campaign');
  });
});
