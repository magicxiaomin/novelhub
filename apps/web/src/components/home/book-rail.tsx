import Link from 'next/link';

import { BookCard } from '@/components/book/book-card';
import type { BookSummary } from '@/lib/types';

export function BookRail({
  title,
  books,
  seeAllHref,
}: {
  title: string;
  books: BookSummary[];
  seeAllHref?: string;
}): JSX.Element | null {
  if (books.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between px-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {seeAllHref ? (
          <Link href={seeAllHref} className="text-sm font-medium text-brand">
            See all
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
