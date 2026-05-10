'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  chooseInitialPlaybackState,
  formatResumeLabel,
  isPlaybackComplete,
  shouldPersistProgress,
} from '@/lib/drama-player';
import {
  fetchEpisodePlayback,
  queryKeys,
  saveDramaProgress,
  unlockDramaEpisode,
} from '@/lib/queries';
import type { DramaDetail, EpisodePlayback, EpisodeProgress, EpisodeSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

type DramaPlayerProps = {
  drama: DramaDetail;
  episode: EpisodeSummary;
  initialPlayback: EpisodePlayback;
  detailHref: string;
};

export function DramaPlayer({
  drama,
  episode,
  initialPlayback,
  detailHref,
}: DramaPlayerProps): JSX.Element {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedSecondsRef = useRef(episode.progress?.positionSeconds ?? 0);
  const [retryKey, setRetryKey] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);

  const playback = useQuery({
    queryKey: queryKeys.episodePlayback(episode.id),
    queryFn: () => fetchEpisodePlayback(episode.id),
    initialData: initialPlayback,
    retry: 1,
  });

  const currentPlayback = playback.data;
  const initialState = useMemo(
    () => chooseInitialPlaybackState(currentPlayback, episode.progress),
    [currentPlayback, episode.progress],
  );
  const isPlaybackRefreshing = playback.isFetching && !playback.isPending;
  const resumeLabel = formatResumeLabel(episode.progress);

  const progressMutation = useMutation({
    mutationFn: saveDramaProgress,
    onMutate: () => setProgressStatus(messages.drama.savingProgress),
    onSuccess: (progress: EpisodeProgress) => {
      setProgressStatus(messages.drama.progressSaved);
      lastSavedSecondsRef.current = progress.positionSeconds;
      queryClient.setQueryData<DramaDetail>(queryKeys.drama(drama.slug), (cached) =>
        cached ? replaceEpisodeProgress(cached, episode.id, progress) : cached,
      );
    },
    onError: () => setProgressStatus(messages.drama.progressUnavailable),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockDramaEpisode(episode.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.episodePlayback(episode.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drama(drama.slug) }),
      ]);
      await playback.refetch();
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || initialState.mode !== 'playback') return;
    if (initialState.resumePositionSeconds > 0 && video.currentTime < 1) {
      video.currentTime = initialState.resumePositionSeconds;
    }
  }, [initialState, retryKey]);

  const persistProgress = (completed: boolean): void => {
    const video = videoRef.current;
    if (!video || currentPlayback.access !== 'granted') return;
    const currentSeconds = Math.floor(video.currentTime);
    const durationSeconds = Number.isFinite(video.duration)
      ? Math.floor(video.duration)
      : currentPlayback.durationSeconds;
    if (
      !shouldPersistProgress({
        lastSavedSeconds: lastSavedSecondsRef.current,
        currentSeconds,
        completed,
      })
    ) {
      return;
    }
    lastSavedSecondsRef.current = currentSeconds;
    progressMutation.mutate({
      episodeId: episode.id,
      positionSeconds: currentSeconds,
      durationSeconds,
      completed,
    });
  };

  const onRetry = (): void => {
    setVideoError(null);
    setRetryKey((key) => key + 1);
    void playback.refetch();
  };

  const nextEpisode = drama.episodes.find(
    (item) => item.episodeNumber === episode.episodeNumber + 1,
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="flex items-center justify-between px-4 py-3">
          <Button
            asChild
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href={detailHref}>{messages.drama.backToDetail}</Link>
          </Button>
          <Badge variant="secondary">
            {messages.reader.chapter} {episode.episodeNumber}
          </Badge>
        </header>

        <section className="flex flex-1 flex-col justify-center px-4 pb-4">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-[2rem] bg-zinc-950 shadow-2xl ring-1 ring-white/10">
            {initialState.mode === 'playback' ? (
              <>
                <video
                  key={`${currentPlayback.episodeId}-${retryKey}`}
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  src={initialState.hlsUrl}
                  poster={
                    currentPlayback.access === 'granted'
                      ? (currentPlayback.thumbnailUrl ?? undefined)
                      : undefined
                  }
                  controls
                  playsInline
                  preload="metadata"
                  onCanPlay={() => setVideoError(null)}
                  onError={() => setVideoError(messages.drama.playbackError)}
                  onTimeUpdate={() => {
                    const video = videoRef.current;
                    const completed = video
                      ? isPlaybackComplete(
                          video.currentTime,
                          Number.isFinite(video.duration)
                            ? video.duration
                            : currentPlayback.durationSeconds,
                        )
                      : false;
                    persistProgress(completed);
                  }}
                  onEnded={() => persistProgress(true)}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4">
                  <p className="text-sm font-semibold">{drama.title}</p>
                  <h1 className="mt-1 text-lg font-black leading-tight">{episode.title}</h1>
                  {resumeLabel ? (
                    <p className="mt-1 text-xs text-white/75">
                      {messages.drama.resumePrefix}: {resumeLabel}
                    </p>
                  ) : null}
                </div>
                {isPlaybackRefreshing ? (
                  <div className="absolute inset-x-6 top-20 rounded-full bg-black/70 px-3 py-2 text-center text-xs text-white/80">
                    {messages.drama.loading}
                  </div>
                ) : null}
                {videoError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
                    <p className="text-sm">{videoError}</p>
                    <p className="mt-2 text-xs text-white/60">{messages.drama.hlsUnsupported}</p>
                    <Button type="button" className="mt-4" onClick={onRetry}>
                      {messages.drama.retryPlayback}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-6 text-center">
                <Badge variant="secondary">{messages.drama.locked}</Badge>
                <h1 className="mt-4 text-2xl font-black">{messages.drama.paywallTitle}</h1>
                <p className="mt-3 text-sm leading-6 text-white/70">{messages.drama.paywallBody}</p>
                <Button
                  type="button"
                  className="mt-6 w-full"
                  onClick={() => unlockMutation.mutate()}
                  disabled={unlockMutation.isPending}
                >
                  {messages.drama.unlockWithCoins.replace(
                    '{coins}',
                    String(initialState.coinPerEpisode),
                  )}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="mt-3 w-full border-white/30 bg-transparent text-white"
                >
                  <Link href="/recharge">{messages.drama.subscribeToUnlock}</Link>
                </Button>
                {unlockMutation.isError ? (
                  <p className="mt-3 text-xs text-red-200">{messages.errors.pleaseTryAgain}</p>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 px-1 text-xs text-white/70">
            <span>{progressStatus}</span>
            {nextEpisode ? (
              <Link
                className="font-semibold text-white underline-offset-4 hover:underline"
                href={`/dramas/${drama.slug}/watch/${nextEpisode.id}`}
              >
                {messages.reader.nextChapter}
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function replaceEpisodeProgress(
  drama: DramaDetail,
  episodeId: string,
  progress: EpisodeProgress,
): DramaDetail {
  return {
    ...drama,
    episodes: drama.episodes.map((item) => (item.id === episodeId ? { ...item, progress } : item)),
  };
}
