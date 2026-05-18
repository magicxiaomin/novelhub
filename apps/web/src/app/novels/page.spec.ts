import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateMetadata } from './page';
import {
  buildCanonicalNovelsAffordance,
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
});

describe('novels route polish', () => {
  it('keeps the empty state actionable without removing the clear-filters affordance', () => {
    const source = readNovelsRouteFile('page.tsx');

    expect(messages.novels.emptyTitle).toBe('No matching novels yet');
    expect(messages.novels.emptyBody).toContain('Clear filters');
    expect(source).toContain('messages.novels.emptyTitle');
    expect(source).toContain('messages.novels.emptyBody');
    expect(source).toContain('messages.novels.clearFilters');
    expect(source).toContain('<Link href="/novels">{messages.novels.clearFilters}</Link>');
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
});
