import type { EpisodePlayback, EpisodeProgress } from './types';

export type InitialDramaPlaybackState =
  | { mode: 'playback'; hlsUrl: string; resumePositionSeconds: number }
  | { mode: 'paywall'; coinPerEpisode: number };

export function chooseInitialPlaybackState(
  playback: EpisodePlayback,
  progress: EpisodeProgress | null,
): InitialDramaPlaybackState {
  if (playback.access === 'denied') {
    return { mode: 'paywall', coinPerEpisode: playback.coinPerEpisode };
  }
  return {
    mode: 'playback',
    hlsUrl: playback.hlsUrl,
    resumePositionSeconds: resumePositionSeconds(progress),
  };
}

export function resumePositionSeconds(progress: EpisodeProgress | null): number {
  if (!progress || progress.completedAt) return 0;
  return progress.positionSeconds >= 5 ? Math.floor(progress.positionSeconds) : 0;
}

export function formatResumeLabel(progress: EpisodeProgress | null): string | null {
  const seconds = resumePositionSeconds(progress);
  if (seconds === 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `Resume from ${minutes}m ${remainingSeconds}s`
    : `Resume from ${remainingSeconds}s`;
}

export function shouldPersistProgress({
  lastSavedSeconds,
  currentSeconds,
  completed,
}: {
  lastSavedSeconds: number;
  currentSeconds: number;
  completed: boolean;
}): boolean {
  if (completed) return true;
  return Math.abs(Math.floor(currentSeconds) - Math.floor(lastSavedSeconds)) >= 10;
}

export function isPlaybackComplete(
  currentSeconds: number,
  durationSeconds: number | null,
): boolean {
  if (!durationSeconds || durationSeconds <= 0) return false;
  return currentSeconds >= Math.max(durationSeconds - 3, durationSeconds * 0.95);
}
