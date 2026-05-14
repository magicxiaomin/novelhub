import Link from 'next/link';

import { BookRail } from '@/components/home/book-rail';
import { NovelHomePage } from '@/components/home/novel-home-page';
import { DramaCard } from '@/components/drama/drama-card';
import { DramaRail } from '@/components/drama/drama-rail';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { isNovelsOnlyProductMode } from '@/lib/productMode';
import { fetchBooksServer, fetchDramasServer } from '@/lib/server-api';
import { messages } from '@novelhub/shared';

export const runtime = 'edge';

type DramaRailResult = Awaited<ReturnType<typeof fetchDramasServer>>;
type BookRailResult = Awaited<ReturnType<typeof fetchBooksServer>>;

async function safeFetchDramaRail(
  query: Parameters<typeof fetchDramasServer>[0],
): Promise<{ data: DramaRailResult | null; error: boolean }> {
  try {
    return { data: await fetchDramasServer(query), error: false };
  } catch {
    return { data: null, error: true };
  }
}

async function safeFetchBookRail(
  query: Parameters<typeof fetchBooksServer>[0],
): Promise<{ data: BookRailResult | null; error: boolean }> {
  try {
    return { data: await fetchBooksServer(query), error: false };
  } catch {
    return { data: null, error: true };
  }
}

export default async function HomePage(): Promise<JSX.Element> {
  if (isNovelsOnlyProductMode()) {
    return <NovelHomePage />;
  }

  const [featuredResult, allResult, newReleasesResult] = await Promise.all([
    safeFetchDramaRail({ featured: true, pageSize: 8 }),
    safeFetchDramaRail({ pageSize: 12 }),
    safeFetchBookRail({ limit: 10 }),
  ]);
  const featuredItems = featuredResult.data?.items ?? [];
  const allItems = allResult.data?.items ?? [];
  const newReleaseItems = newReleasesResult.data?.items ?? [];
  const hero = featuredItems[0] ?? allItems[0];

  return (
    <AppShell>
      <div className="pt-4">
        <section className="px-4">
          <div className="rounded-3xl bg-gradient-to-br from-rose-600 via-fuchsia-600 to-slate-950 p-5 text-white shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">
              {messages.drama.heroEyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight">{messages.drama.heroTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-white/85">{messages.drama.heroBody}</p>
            <div className="mt-5 flex items-center gap-3">
              {hero ? (
                <Button asChild>
                  <Link href={`/dramas/${hero.slug}`}>{messages.drama.watchNow}</Link>
                </Button>
              ) : null}
              <Button
                asChild
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/novels">{messages.drama.novelsLink}</Link>
              </Button>
            </div>
          </div>
        </section>

        <DramaRail
          title={messages.drama.featured}
          dramas={featuredItems}
          emptyMessage={messages.drama.featuredEmpty}
          errorMessage={featuredResult.error ? messages.drama.browseError : undefined}
        />

        <BookRail
          title={messages.home.newReleases}
          books={newReleaseItems}
          seeAllHref="/novels"
          emptyMessage={messages.home.railEmpty}
          errorMessage={newReleasesResult.error ? messages.home.railError : undefined}
        />

        <section className="mt-6 px-4">
          <h2 className="text-lg font-semibold tracking-tight">{messages.drama.all}</h2>
          {allResult.error ? (
            <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {messages.drama.browseError}
            </p>
          ) : allItems.length === 0 ? (
            <p className="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              {messages.drama.allEmpty}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-4">
              {allItems.map((drama, index) => (
                <DramaCard key={drama.id} drama={drama} priority={index < 2} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
