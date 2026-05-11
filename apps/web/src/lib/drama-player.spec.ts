import { describe, expect, it } from 'vitest';

import {
  chooseHlsPlaybackMode,
  chooseInitialPlaybackState,
  formatResumeLabel,
  getDramaPaywallDecision,
  shouldPersistProgress,
} from './drama-player';
import type { EpisodePlayback, EpisodeProgress } from './types';

const granted: EpisodePlayback = {
  episodeId: 'ep-1',
  dramaId: 'drama-1',
  episodeNumber: 1,
  title: 'Episode 1',
  durationSeconds: 120,
  access: 'granted',
  accessReason: 'free',
  hlsUrl: 'https://cdn.example.test/drama/ep1.m3u8',
  provider: 'external_hls',
  thumbnailUrl: null,
};

const denied: EpisodePlayback = {
  episodeId: 'ep-2',
  dramaId: 'drama-1',
  episodeNumber: 2,
  title: 'Episode 2',
  durationSeconds: 120,
  access: 'denied',
  accessReason: 'locked',
  coinPerEpisode: 5,
};

const progress: EpisodeProgress = {
  positionSeconds: 42,
  durationSeconds: 120,
  completedAt: null,
  lastWatchedAt: '2026-05-10T18:00:00.000Z',
};

describe('drama player helpers', () => {
  it('starts granted playback at the saved resume position', () => {
    expect(chooseInitialPlaybackState(granted, progress)).toEqual({
      mode: 'playback',
      resumePositionSeconds: 42,
      hlsUrl: 'https://cdn.example.test/drama/ep1.m3u8',
    });
  });

  it('shows a paywall when playback access is denied', () => {
    expect(chooseInitialPlaybackState(denied, progress)).toEqual({
      mode: 'paywall',
      coinPerEpisode: 5,
    });
  });

  it('does not resume completed or near-zero progress', () => {
    expect(formatResumeLabel({ ...progress, completedAt: '2026-05-10T18:05:00.000Z' })).toBeNull();
    expect(formatResumeLabel({ ...progress, positionSeconds: 3 })).toBeNull();
  });

  it('formats resume copy in whole minutes', () => {
    expect(formatResumeLabel({ ...progress, positionSeconds: 125 })).toBe('Resume from 2m 5s');
    expect(formatResumeLabel({ ...progress, positionSeconds: 61 })).toBe('Resume from 1m 1s');
  });

  it('throttles progress writes until ten seconds or completion', () => {
    expect(
      shouldPersistProgress({ lastSavedSeconds: 20, currentSeconds: 25, completed: false }),
    ).toBe(false);
    expect(
      shouldPersistProgress({ lastSavedSeconds: 20, currentSeconds: 30, completed: false }),
    ).toBe(true);
    expect(
      shouldPersistProgress({ lastSavedSeconds: 20, currentSeconds: 21, completed: true }),
    ).toBe(true);
  });

  it('chooses native HLS before MSE playback', () => {
    expect(chooseHlsPlaybackMode({ canPlayNativeHls: true, hlsJsSupported: true })).toBe('native');
    expect(chooseHlsPlaybackMode({ canPlayNativeHls: false, hlsJsSupported: true })).toBe('mse');
    expect(chooseHlsPlaybackMode({ canPlayNativeHls: false, hlsJsSupported: false })).toBe(
      'unsupported',
    );
  });

  it('blocks anonymous coin unlocks and points subscription CTA at subscribe tab', () => {
    expect(
      getDramaPaywallDecision({
        isAuthenticated: false,
        authLoading: false,
        isUnlocking: false,
        unlockSucceeded: false,
      }),
    ).toMatchObject({
      canAttemptCoinUnlock: false,
      primaryAction: 'signin',
      primaryDisabled: false,
      subscribeHref: '/recharge?tab=subscribe',
      status: 'sign-in-first',
    });
  });

  it('allows authenticated coin unlock after auth state resolves', () => {
    expect(
      getDramaPaywallDecision({
        isAuthenticated: true,
        authLoading: false,
        isUnlocking: false,
        unlockSucceeded: false,
      }),
    ).toMatchObject({
      canAttemptCoinUnlock: true,
      primaryAction: 'unlock',
      primaryDisabled: false,
      status: 'idle',
    });
  });
});
