import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DramaPlayer } from '@/components/drama/drama-player';
import { isNovelsOnlyProductMode } from '@/lib/productMode';
import { fetchDramaServer, fetchEpisodePlaybackServer } from '@/lib/server-api';
import { messages } from '@novelhub/shared';

export const runtime = 'edge';

type Params = { params: { slug: string; episodeId: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (isNovelsOnlyProductMode()) return { title: messages.drama.notFound };

  const drama = await fetchDramaServer(params.slug).catch(() => null);
  const episode = drama?.episodes.find((item) => item.id === params.episodeId);
  if (!drama || !episode) return { title: messages.drama.notFound };
  return {
    title: `${episode.title} | ${drama.title}`,
    description: episode.synopsis ?? drama.description.slice(0, 160),
  };
}

export default async function DramaWatchPage({ params }: Params): Promise<JSX.Element> {
  if (isNovelsOnlyProductMode()) {
    notFound();
  }

  const drama = await fetchDramaServer(params.slug);
  if (!drama) notFound();

  const episode = drama.episodes.find((item) => item.id === params.episodeId);
  if (!episode) notFound();

  const playback = await fetchEpisodePlaybackServer(episode.id);
  if (!playback) notFound();

  return (
    <DramaPlayer
      drama={drama}
      episode={episode}
      initialPlayback={playback}
      detailHref={`/dramas/${drama.slug}`}
    />
  );
}
