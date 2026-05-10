import Link from 'next/link';

import { DramaCard } from '@/components/drama/drama-card';
import { DramaRail } from '@/components/drama/drama-rail';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { fetchDramasServer } from '@/lib/server-api';
import { messages } from '@novelhub/shared';

export const runtime = 'edge';

export default async function HomePage(): Promise<JSX.Element> {
  const [featured, all] = await Promise.all([
    fetchDramasServer({ featured: true, pageSize: 8 }).catch(() => null),
    fetchDramasServer({ pageSize: 12 }).catch(() => null),
  ]);
  const featuredItems = featured?.items ?? [];
  const allItems = all?.items ?? [];
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
                  <Link href={`/drama/${hero.slug}`}>{messages.drama.watchNow}</Link>
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

        <DramaRail title={messages.drama.featured} dramas={featuredItems} />

        <section className="mt-6 px-4">
          <h2 className="text-lg font-semibold tracking-tight">{messages.drama.all}</h2>
          {allItems.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{messages.drama.empty}</p>
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
