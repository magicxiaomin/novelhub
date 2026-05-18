import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/book/book-card';
import { fetchBooksServer, fetchBookCategoriesServer } from '@/lib/server-api';
import {
  buildNovelsHref,
  parseNovelsFilters,
  statusFilterOptions,
  toBooksListQuery,
  type NovelsSearchParams,
} from '@/lib/novels-filters';
import {
  buildCanonicalNovelsAffordance,
  novelsCanonicalPath,
  shouldRedirectToCanonicalNovelsHref,
  shouldShowCanonicalNovelsAffordance,
} from './canonical-affordance';
import { messages } from '@novelhub/shared';

export const runtime = 'edge';

const baseMetadata: Metadata = {
  title: messages.metadata.novels.title,
  description: messages.metadata.novels.description,
  alternates: {
    canonical: novelsCanonicalPath,
  },
  openGraph: {
    title: messages.metadata.novels.title,
    description: messages.metadata.novels.description,
    type: 'website',
    images: [{ url: '/og/novels.png', alt: messages.metadata.novels.ogAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: messages.metadata.novels.title,
    description: messages.metadata.novels.description,
    images: ['/og/novels.png'],
  },
};

const pageSize = 20;

type NovelsPageProps = {
  searchParams?: NovelsSearchParams;
};

export async function generateMetadata({ searchParams }: NovelsPageProps): Promise<Metadata> {
  const hasFilteredView = shouldShowCanonicalNovelsAffordance(searchParams);

  return {
    ...baseMetadata,
    ...(hasFilteredView ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function NovelsPage({ searchParams }: NovelsPageProps): Promise<JSX.Element> {
  const canonicalRedirectHref = shouldRedirectToCanonicalNovelsHref(searchParams);
  if (canonicalRedirectHref) {
    redirect(canonicalRedirectHref);
  }

  const filters = parseNovelsFilters(searchParams);
  const booksQuery = toBooksListQuery(filters, pageSize);
  const [books, categories] = await Promise.all([
    fetchBooksServer(booksQuery),
    fetchBookCategoriesServer(),
  ]);
  const totalPages = Math.max(1, Math.ceil(books.total / books.limit));
  if (booksQuery.page > totalPages) {
    redirect(buildNovelsHref(filters, { page: totalPages }));
  }

  const hasActiveFilters = Boolean(filters.category || filters.status);
  const canonicalAffordance = buildCanonicalNovelsAffordance(searchParams);

  return (
    <AppShell>
      <main className="px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{messages.novels.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{messages.novels.subtitle}</p>
          </div>
          {hasActiveFilters ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/novels">{messages.novels.clearFilters}</Link>
            </Button>
          ) : null}
        </div>

        <section className="mt-5 space-y-4" aria-label={messages.novels.filtersLabel}>
          <FilterGroup label={messages.novels.categoryFilterLabel}>
            <FilterLink
              href={buildNovelsHref(filters, { category: undefined })}
              active={!filters.category}
            >
              {messages.novels.allCategories}
            </FilterLink>
            {categories.map((category) => (
              <FilterLink
                key={category.category}
                href={buildNovelsHref(filters, { category: category.category })}
                active={filters.category === category.category}
              >
                {category.category}
              </FilterLink>
            ))}
          </FilterGroup>

          <FilterGroup label={messages.novels.statusFilterLabel}>
            <FilterLink
              href={buildNovelsHref(filters, { status: undefined })}
              active={!filters.status}
            >
              {messages.novels.allStatuses}
            </FilterLink>
            {statusFilterOptions.map((status) => (
              <FilterLink
                key={status.value}
                href={buildNovelsHref(filters, { status: status.value })}
                active={filters.status === status.value}
              >
                {status.label}
              </FilterLink>
            ))}
          </FilterGroup>

          {canonicalAffordance ? (
            <p className="text-sm text-muted-foreground">
              <Link
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={canonicalAffordance.href}
              >
                {canonicalAffordance.label}
              </Link>
            </p>
          ) : null}
        </section>

        {books.items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed p-8 text-center">
            <h2 className="text-lg font-semibold">{messages.novels.emptyTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{messages.novels.emptyBody}</p>
            {hasActiveFilters ? (
              <Button asChild className="mt-5">
                <Link href="/novels">{messages.novels.clearFilters}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
            {books.items.map((book) => (
              <BookCard key={book.id} book={book} size="md" />
            ))}
          </div>
        )}

        <nav
          className="mt-8 flex items-center justify-between"
          aria-label={messages.novels.paginationLabel}
        >
          {books.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={buildNovelsHref(filters, { page: books.page - 1 })}>
                {messages.novels.previousPage}
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              {messages.novels.previousPage}
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {messages.novels.pageCount
              .replace('{page}', String(books.page))
              .replace('{pages}', String(totalPages))}
          </span>
          {books.page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={buildNovelsHref(filters, { page: books.page + 1 })}>
                {messages.novels.nextPage}
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              {messages.novels.nextPage}
            </Button>
          )}
        </nav>
      </main>
    </AppShell>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <h2 className="text-sm font-semibold">{label}</h2>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      <Badge variant={active ? 'default' : 'secondary'} className="rounded-full px-3 py-1">
        {children}
      </Badge>
    </Link>
  );
}
