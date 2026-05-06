'use client';

import { useQuery } from '@tanstack/react-query';

import { AppShell } from '@/components/layout/app-shell';
import { BookRail } from '@/components/home/book-rail';
import { CategorySection } from '@/components/home/category-section';
import { ContinueReadingRail } from '@/components/home/continue-reading-rail';
import { FeaturedCarousel } from '@/components/home/featured-carousel';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchBooks,
  fetchCategories,
  fetchFeatured,
  fetchTrending,
  queryKeys,
} from '@/lib/queries';
import messages from '@/../messages/en.json';

export default function HomePage(): JSX.Element {
  const featured = useQuery({ queryKey: queryKeys.featured, queryFn: fetchFeatured });
  const trending = useQuery({ queryKey: queryKeys.trending, queryFn: fetchTrending });
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories });
  const newReleases = useQuery({
    queryKey: queryKeys.list({ limit: 10 }),
    queryFn: () => fetchBooks({ limit: 10 }),
  });

  return (
    <AppShell>
      <div className="pt-3">
        {featured.isLoading ? (
          <Skeleton className="mx-4 aspect-[16/9] rounded-2xl" />
        ) : (
          <FeaturedCarousel books={featured.data ?? []} />
        )}

        <ContinueReadingRail />

        {trending.isLoading ? (
          <RailSkeleton title={messages.home.trending} />
        ) : (
          <BookRail
            title={messages.home.trending}
            books={trending.data ?? []}
            seeAllHref="/category/trending"
          />
        )}

        {newReleases.isLoading ? (
          <RailSkeleton title={messages.home.newReleases} />
        ) : (
          <BookRail
            title={messages.home.newReleases}
            books={newReleases.data?.items ?? []}
            seeAllHref="/category/new"
          />
        )}

        {categories.isLoading
          ? Array.from({ length: 2 }).map((_, i) => <RailSkeleton key={i} title="" />)
          : (categories.data ?? []).map((c) => (
              <CategorySection key={c.category} category={c.category} />
            ))}
      </div>
    </AppShell>
  );
}

function RailSkeleton({ title }: { title: string }): JSX.Element {
  return (
    <section className="mt-6">
      {title ? (
        <h2 className="px-4 text-lg font-semibold tracking-tight">{title}</h2>
      ) : (
        <Skeleton className="mx-4 h-5 w-32" />
      )}
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-36 shrink-0 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
