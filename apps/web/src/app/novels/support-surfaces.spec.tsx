import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BookNotFound from '@/app/book/[id]/not-found';
import { messages } from '@novelhub/shared';

import {
  buildCanonicalNovelsAffordance,
  novelsCanonicalPath,
  shouldShowCanonicalNovelsAffordance,
} from './canonical-affordance';
import NovelsError from './error';
import NovelsLoading from './loading';
import NovelsNotFound from './not-found';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-app-shell': true }, children),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: {
    asChild?: boolean;
    children: React.ReactNode;
    [key: string]: unknown;
  }) =>
    asChild
      ? React.createElement(React.Fragment, null, children)
      : React.createElement('button', props, children),
}));

vi.mock('@/components/book/book-card', () => ({
  BookCardSkeleton: () => React.createElement('article', { 'data-book-card-skeleton': true }),
}));

beforeEach(() => {
  vi.stubGlobal('React', React);
});

describe('novels funnel support surfaces', () => {
  it('renders the loading surface as a server-safe skeleton grid inside the app shell', () => {
    const html = renderToStaticMarkup(<NovelsLoading />);

    expect(html).toContain('data-app-shell="true"');
    expect(html).toContain(`aria-label="${messages.novels.loadingSkeletonLabel}"`);
    expect(html.match(/data-book-card-skeleton="true"/g)).toHaveLength(8);
    expect(html).toContain('motion-reduce:animate-none');
  });

  it('renders the novels error surface with retry copy, digest context, and novels fallback link', () => {
    const html = renderToStaticMarkup(
      <NovelsError
        error={Object.assign(new Error('load failed'), { digest: 'digest-438' })}
        reset={vi.fn()}
      />,
    );

    expect(html).toContain('data-app-shell="true"');
    expect(html).toContain(messages.errors.novelsRouteError);
    expect(html).toContain(`${messages.errors.novelsRouteErrorBody} (digest-438)`);
    expect(html).toContain(messages.errors.routeBoundaryReset);
    expect(html).toContain(`href="${novelsCanonicalPath}"`);
    expect(html).toContain(messages.errors.backToNovels);
  });

  it('renders the novels not-found surface with shared empty-state copy and a home escape hatch', () => {
    const html = renderToStaticMarkup(<NovelsNotFound />);

    expect(html).toContain('data-app-shell="true"');
    expect(html).toContain(messages.errors.novelsNotFound);
    expect(html).toContain(messages.errors.novelsNotFoundBody);
    expect(html).toContain('href="/"');
    expect(html).toContain(messages.errors.backToHome);
  });

  it('keeps book detail not-found scoped to shared book copy without app-shell client imports', () => {
    const html = renderToStaticMarkup(<BookNotFound />);

    expect(html).toContain(messages.errors.bookNotFound);
    expect(html).toContain('might have been removed');
    expect(html).toContain('href="/"');
    expect(html).toContain(messages.errors.backToHome);
    expect(html).not.toContain('data-app-shell="true"');
  });

  it('normalizes canonical affordance support to the novels route only after filters survive parsing', () => {
    expect(novelsCanonicalPath).toBe('/novels');
    expect(shouldShowCanonicalNovelsAffordance({ category: ' ', status: 'DRAFT', page: '1' })).toBe(
      false,
    );
    expect(
      buildCanonicalNovelsAffordance({ category: ' ', status: 'DRAFT', page: '1' }),
    ).toBeNull();
    expect(
      buildCanonicalNovelsAffordance({ category: 'Fantasy', status: 'ONGOING', page: '2' }),
    ).toEqual({
      href: '/novels',
      label: messages.novels.filteredViewCanonicalCta,
    });
  });
});
