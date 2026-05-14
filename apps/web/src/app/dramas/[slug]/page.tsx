import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isNovelsOnlyProductMode } from '@/lib/productMode';
import { fetchDramaServer } from '@/lib/server-api';
import type { EpisodeSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

export const runtime = 'edge';

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (isNovelsOnlyProductMode()) return { title: messages.drama.notFound };

  const drama = await fetchDramaServer(params.slug).catch(() => null);
  if (!drama) return { title: messages.drama.notFound };
  return {
    title: drama.title,
    description: drama.description.slice(0, 160),
    openGraph: {
      title: drama.title,
      description: drama.description,
      images: [{ url: drama.posterUrl }],
      type: 'video.tv_show',
    },
  };
}

export default async function DramaDetailPage({ params }: Params): Promise<JSX.Element> {
  if (isNovelsOnlyProductMode()) {
    redirect('/novels');
  }

  const drama = await fetchDramaServer(params.slug);
  if (!drama) notFound();

  const startEpisode = selectStartEpisode(drama.episodes);

  return (
    <AppShell>
      <header className="px-4 pt-4">
        <div className="flex gap-4">
          <div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-2xl bg-muted">
            <Image
              src={drama.posterUrl}
              alt=""
              fill
              sizes="144px"
              priority
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <Badge variant="secondary">{drama.category}</Badge>
            <h1 className="mt-3 text-2xl font-black leading-tight">{drama.title}</h1>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              {drama.status}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
              <Stat value={drama.totalEpisodes.toString()} label={messages.drama.episodes} />
              <Stat value={drama.freeEpisodeCount.toString()} label={messages.drama.freeEpisodes} />
            </div>
          </div>
        </div>
        {startEpisode ? (
          <Button asChild className="mt-5 w-full">
            <Link href={`/dramas/${drama.slug}/watch/${startEpisode.id}`}>
              {startEpisode.progress ? messages.drama.continueWatching : messages.drama.watchNow}
            </Link>
          </Button>
        ) : (
          <Button className="mt-5 w-full" disabled>
            {messages.drama.episodesComingSoon}
          </Button>
        )}
      </header>

      <section className="mt-6 px-4">
        <h2 className="text-base font-semibold tracking-tight">{messages.drama.about}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{drama.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {drama.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="text-base font-semibold tracking-tight">{messages.drama.episodeList}</h2>
        <div className="mt-3 divide-y rounded-2xl border bg-card">
          {drama.episodes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{messages.drama.episodesComingSoon}</p>
          ) : (
            drama.episodes.map((episode) => (
              <Link
                key={episode.id}
                href={`/dramas/${drama.slug}/watch/${episode.id}`}
                id={`episode-${episode.episodeNumber}`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {episode.episodeNumber}. {episode.title}
                  </p>
                  {episode.synopsis ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {episode.synopsis}
                    </p>
                  ) : null}
                </div>
                <Badge variant={episode.isFree || episode.isUnlocked ? 'secondary' : 'outline'}>
                  {episode.isFree
                    ? messages.drama.free
                    : episode.isUnlocked
                      ? messages.reader.unlocked
                      : messages.drama.locked}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </section>
      <div className="h-8" />
    </AppShell>
  );
}

function selectStartEpisode(episodes: EpisodeSummary[]): EpisodeSummary | undefined {
  return (
    episodes.find((episode) => episode.progress && !episode.progress.completedAt) ?? episodes[0]
  );
}

function Stat({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div className="rounded-xl border bg-background/80 px-2 py-3">
      <p className="font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-muted-foreground">{label}</p>
    </div>
  );
}
