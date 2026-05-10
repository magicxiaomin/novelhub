import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DramaPlayer } from '@/components/drama/drama-player';
import { fetchDramaServer, fetchEpisodePlaybackServer } from '@/lib/server-api';
import { messages } from '@novelhub/shared';

export const runtime = 'edge';

type Params = { params: { slug: string; episodeNumber: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const drama = await fetchDramaServer(params.slug).catch(() => null);
  const episodeNumber = parseEpisodeNumber(params.episodeNumber);
  const episode = drama?.episodes.find((item) => item.episodeNumber === episodeNumber);
  if (!drama || !episode) return { title: messages.drama.notFound };
  return {
    title: `${episode.title} | ${drama.title}`,
    description: episode.synopsis ?? drama.description.slice(0, 160),
  };
}

export default async function DramaWatchPage({ params }: Params): Promise<JSX.Element> {
  const drama = await fetchDramaServer(params.slug);
  if (!drama) notFound();

  const episodeNumber = parseEpisodeNumber(params.episodeNumber);
  const episode = drama.episodes.find((item) => item.episodeNumber === episodeNumber);
  if (!episode) notFound();

  const playback = await fetchEpisodePlaybackServer(episode.id);
  if (!playback) notFound();

  return (
    <DramaPlayer
      drama={drama}
      episode={episode}
      initialPlayback={playback}
      detailHref={`/drama/${drama.slug}`}
    />
  );
}

function parseEpisodeNumber(value: string): number {
  const episodeNumber = Number.parseInt(value, 10);
  return Number.isFinite(episodeNumber) ? episodeNumber : -1;
}
