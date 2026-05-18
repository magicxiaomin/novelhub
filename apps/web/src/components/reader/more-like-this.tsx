import React from 'react';
import Link from 'next/link';

import { BookCard } from '@/components/book/book-card';
import type { BookSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

export function MoreLikeThis({ books }: { books: BookSummary[] }): JSX.Element {
  return (
    <section
      className="mx-auto max-w-mobile px-5 pb-28 pt-2"
      aria-labelledby="more-like-this-heading"
    >
      <h2 id="more-like-this-heading" className="text-lg font-semibold tracking-tight">
        {messages.reader.moreLikeThis}
      </h2>
      {books.length === 0 ? (
        <Link
          href="/novels"
          className="mt-3 block rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-muted"
        >
          {messages.reader.browseAllNovels}
        </Link>
      ) : (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto scroll-smooth">
          {books.map((book) => (
            <BookCard key={book.id} book={book} size="sm" />
          ))}
        </div>
      )}
    </section>
  );
}
