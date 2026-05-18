import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isSuccess: false, isLoading: false, isError: false }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/paywall/paywall', () => ({ Paywall: () => null }));
vi.mock('@/components/reader/bottom-bar', () => ({ ReaderBottomBar: () => null }));
vi.mock('@/components/reader/chapter-list-drawer', () => ({ ChapterListDrawer: () => null }));
vi.mock('@/components/reader/settings-drawer', () => ({ SettingsDrawer: () => null }));
vi.mock('@/components/reader/top-bar', () => ({ ReaderTopBar: () => null }));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/components/ui/skeleton', () => ({ Skeleton: () => null }));
vi.mock('@/components/providers', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/anonymous-reading-progress', () => ({
  loadAnonymousChapterProgress: vi.fn(),
  saveAnonymousReadingProgress: vi.fn(),
}));
vi.mock('@/lib/queries', () => ({
  fetchBookChapters: vi.fn(),
  fetchChapterReadingProgress: vi.fn(),
  fetchUnlocks: vi.fn(),
  queryKeys: {
    unlocks: vi.fn(() => ['unlocks']),
    chapterContent: vi.fn(() => ['chapterContent']),
  },
  saveReadingProgress: vi.fn(),
}));
vi.mock('@/lib/read-count', () => ({ incrementChaptersReadCount: vi.fn() }));
vi.mock('@/lib/reader-settings', () => ({
  DEFAULT_READER_SETTINGS: {
    theme: 'light',
    fontSize: 'm',
    lineHeight: 'default',
    fontFamily: 'sans',
    autoAdvance: false,
  },
  loadReaderSettings: vi.fn(() => ({
    theme: 'light',
    fontSize: 'm',
    lineHeight: 'default',
    fontFamily: 'sans',
    autoAdvance: false,
  })),
  saveReaderSettings: vi.fn(),
}));
vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' '),
}));

import { prefetchAdjacentReaderRoutes } from './reader-content';

describe('prefetchAdjacentReaderRoutes', () => {
  it('prefetches each defined adjacent reader href once when reduced-data preferences are absent', () => {
    const router = { prefetch: vi.fn() };

    prefetchAdjacentReaderRoutes(router, {
      prevHref: '/read/book-1/1',
      nextHref: '/read/book-1/3',
    });

    expect(router.prefetch).toHaveBeenCalledTimes(2);
    expect(router.prefetch).toHaveBeenNthCalledWith(1, '/read/book-1/1');
    expect(router.prefetch).toHaveBeenNthCalledWith(2, '/read/book-1/3');
  });

  it('skips prefetching when save-data is enabled', () => {
    const router = { prefetch: vi.fn() };
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { connection: { saveData: true } },
    });

    try {
      prefetchAdjacentReaderRoutes(router, {
        prevHref: '/read/book-1/1',
        nextHref: '/read/book-1/3',
      });
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }

    expect(router.prefetch).not.toHaveBeenCalled();
  });

  it('skips prefetching when prefers-reduced-data is active', () => {
    const router = { prefetch: vi.fn() };
    const originalMatchMedia = globalThis.matchMedia;
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    try {
      prefetchAdjacentReaderRoutes(router, {
        prevHref: '/read/book-1/1',
        nextHref: '/read/book-1/3',
      });
    } finally {
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }

    expect(router.prefetch).not.toHaveBeenCalled();
  });
});
