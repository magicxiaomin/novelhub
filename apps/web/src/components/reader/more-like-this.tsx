import { BookCard } from '@/components/book/book-card';
import type { BookSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

export function MoreLikeThis({ books }: { books: BookSummary[] }): JSX.Element | null {
  if (books.length === 0) return null;

  return (
    <section
      className="mx-auto max-w-mobile px-5 pb-28 pt-2"
      aria-labelledby="more-like-this-heading"
    >
      <h2 id="more-like-this-heading" className="text-lg font-semibold tracking-tight">
        {messages.reader.moreLikeThis}
      </h2>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto scroll-smooth">
        {books.map((book) => (
          <BookCard key={book.id} book={book} size="sm" />
        ))}
      </div>
    </section>
  );
}
