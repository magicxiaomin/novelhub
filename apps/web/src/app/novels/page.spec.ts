import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateMetadata } from './page';
import {
  buildCanonicalNovelsAffordance,
  shouldRedirectToCanonicalNovelsHref,
  shouldShowCanonicalNovelsAffordance,
} from './canonical-affordance';
import { messages } from '@novelhub/shared';

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

    expect(messages.novels.filteredEmptyTitle).toBe('No novels match these filters');
    expect(messages.novels.filteredEmptyBody).toContain('Try clearing filters');
    expect(messages.novels.filteredEmptyTitle).not.toBe(messages.novels.emptyTitle);
    expect(messages.novels.filteredEmptyBody).not.toBe(messages.novels.emptyBody);
    expect(source).toContain('messages.novels.filteredEmptyTitle');
    expect(source).toContain('messages.novels.filteredEmptyBody');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('<Link href="/novels">{messages.novels.clearFilters}</Link>');
  });

  it('keeps the truly-empty catalog state free of misleading filter reset copy', () => {
    const source = readNovelsRouteFile('page.tsx');

    expect(messages.novels.emptyTitle).toBe('No novels are available yet');
    expect(messages.novels.emptyBody).toContain('New stories are coming soon');
    expect(messages.novels.emptyBody).not.toContain('filter');
    expect(messages.novels.emptyBody).not.toContain('Clear filters');
    expect(source).toContain('const emptyStateTitle = hasActiveFilters');
    expect(source).toContain('const emptyStateBody = hasActiveFilters');
    expect(source).toContain('? messages.novels.filteredEmptyTitle');
    expect(source).toContain('? messages.novels.filteredEmptyBody');
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
