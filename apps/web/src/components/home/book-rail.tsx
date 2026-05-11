import Link from 'next/link';

import { BookCard } from '@/components/book/book-card';
import type { BookSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

export function BookRail({
  title,
  books,
  seeAllHref,
  emptyMessage,
  errorMessage,
}: {
  title: string;
  books: BookSummary[];
  seeAllHref?: string;
  emptyMessage?: string;
  errorMessage?: string;
}): JSX.Element | null {
  if (errorMessage) {
    return (
      <section className="mt-6 px-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </p>
      </section>
    );
  }

  if (books.length === 0) {
    if (!emptyMessage) return null;
    return (
      <section className="mt-6 px-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between px-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {seeAllHref ? (
          <Link href={seeAllHref} className="text-sm font-medium text-brand">
            {messages.home.seeAll}
          </Link>
        ) : null}
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto scroll-smooth px-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}
