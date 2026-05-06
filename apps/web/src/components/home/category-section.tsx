'use client';

import { useQuery } from '@tanstack/react-query';

import { BookRail } from '@/components/home/book-rail';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchBooks, queryKeys } from '@/lib/queries';

export function CategorySection({ category }: { category: string }): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.list({ category, limit: 10 }),
    queryFn: () => fetchBooks({ category, limit: 10 }),
  });

  if (isLoading) {
    return (
      <section className="mt-6">
        <Skeleton className="mx-4 h-5 w-32" />
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-36 shrink-0 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <BookRail
      title={category}
      books={data?.items ?? []}
      seeAllHref={`/category/${encodeURIComponent(category)}`}
    />
  );
}
