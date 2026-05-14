import { DramaCard } from '@/components/drama/drama-card';
import { DramaRail } from '@/components/drama/drama-rail';
import { AppShell } from '@/components/layout/app-shell';
import { isNovelsOnlyProductMode } from '@/lib/productMode';
import { fetchDramasServer } from '@/lib/server-api';
import { messages } from '@novelhub/shared';
import { notFound } from 'next/navigation';

export const runtime = 'edge';

type DramaResult = Awaited<ReturnType<typeof fetchDramasServer>>;

async function safeFetchDramas(
  query: Parameters<typeof fetchDramasServer>[0],
): Promise<{ data: DramaResult | null; error: boolean }> {
  try {
    return { data: await fetchDramasServer(query), error: false };
  } catch {
    return { data: null, error: true };
  }
}

export default async function DramasPage(): Promise<JSX.Element> {
  if (isNovelsOnlyProductMode()) {
    notFound();
  }

  const [featuredResult, allResult] = await Promise.all([
    safeFetchDramas({ featured: true, pageSize: 10 }),
    safeFetchDramas({ pageSize: 24 }),
  ]);
  const featuredItems = featuredResult.data?.items ?? [];
  const allItems = allResult.data?.items ?? [];

  return (
    <AppShell>
      <main className="pt-4">
        <section className="px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {messages.drama.heroEyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">{messages.drama.browseTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {messages.drama.browseBody}
          </p>
        </section>

        <DramaRail
          title={messages.drama.featured}
          dramas={featuredItems}
          emptyMessage={messages.drama.featuredEmpty}
          errorMessage={featuredResult.error ? messages.drama.browseError : undefined}
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
        <div className="h-8" />
      </main>
    </AppShell>
  );
}
