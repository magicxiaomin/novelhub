'use client';

import { useQuery } from '@tanstack/react-query';

import { BookRail } from '@/components/home/book-rail';
import { fetchBooks, queryKeys } from '@/lib/queries';
import { messages } from '@novelhub/shared';

export function RelatedBooks({
  bookId,
  category,
}: {
  bookId: string;
  category: string;
}): JSX.Element | null {
  const { data } = useQuery({
    queryKey: queryKeys.list({ category, limit: 10 }),
    queryFn: () => fetchBooks({ category, limit: 10 }),
  });
  const books = (data?.items ?? []).filter((book) => book.id !== bookId);

  return <BookRail title={messages.book.youMayAlsoLike} books={books} />;
}
