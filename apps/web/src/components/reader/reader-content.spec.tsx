import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isSuccess: false, isLoading: false, isError: false }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/paywall/paywall', () => ({
  Paywall: () => <section data-testid="reader-paywall">Paywall</section>,
}));
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
  applyReaderSettingsToDocument: vi.fn(() => ({
    theme: 'light',
    fontSize: 'm',
    lineHeight: 'default',
    fontFamily: 'sans',
    autoAdvance: false,
  })),
}));
vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' '),
}));

import {
  calculateReaderScrollProgress,
  isReducedMotionPreferred,
  loadReaderScrollRestoreY,
  prefetchAdjacentReaderRoutes,
  readerScrollRestoreKey,
  ReaderContent,
} from './reader-content';
import type { ChapterResponse, Paginated, ChapterSummary } from '@/lib/types';

const baseChapter: ChapterResponse = {
  id: 'chapter-1',
  bookId: 'book-1',
  title: 'Chapter 1',
  chapterNumber: 1,
  isLocked: false,
  contentUrl: 'https://assets.example.com/chapter-1.txt',
  wordCount: 1234,
  prevChapterId: null,
  nextChapterId: null,
};

const lockedChapter: ChapterResponse = {
  id: 'chapter-1',
  bookId: 'book-1',
  title: 'Chapter 1',
  chapterNumber: 1,
  isLocked: true,
  preview: 'Locked preview',
  unlockOptions: {
    coinCost: 30,
    canUnlockWithCoins: true,
    canUnlockWithSubscription: true,
  },
};

const initialChapters: Paginated<ChapterSummary> = {
  items: [],
  total: 0,
  page: 1,
  limit: 200,
};

describe('calculateReaderScrollProgress', () => {
  it('clamps live scroll progress between 0 and 100 percent', () => {
    expect(
      calculateReaderScrollProgress({ scrollY: -50, scrollHeight: 1200, innerHeight: 200 }),
    ).toBe(0);
    expect(
      calculateReaderScrollProgress({ scrollY: 500, scrollHeight: 1200, innerHeight: 200 }),
    ).toBe(50);
    expect(
      calculateReaderScrollProgress({ scrollY: 1400, scrollHeight: 1200, innerHeight: 200 }),
    ).toBe(100);
  });

  it('returns 100 percent when the document has no scrollable area', () => {
    expect(calculateReaderScrollProgress({ scrollY: 0, scrollHeight: 600, innerHeight: 600 })).toBe(
      100,
    );
  });
});

describe('ReaderContent scroll progress indicator', () => {
  it('renders for unlocked chapter content', () => {
    const html = renderToStaticMarkup(
      <ReaderContent
        chapter={baseChapter}
        initialChapters={initialChapters}
        currentUrl="/read/book-1/1"
        bookTitle="Book 1"
        bookCover="/cover.jpg"
      />,
    );

    expect(html).toContain('aria-label="Reader scroll progress"');
    expect(html).not.toContain('data-testid="reader-paywall"');
  });

  it('omits progress transition classes when reduced motion is preferred', () => {
    const originalMatchMedia = globalThis.matchMedia;
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
      })),
    });

    try {
      expect(isReducedMotionPreferred()).toBe(true);
      const html = renderToStaticMarkup(
        <ReaderContent
          chapter={baseChapter}
          initialChapters={initialChapters}
          currentUrl="/read/book-1/1"
          bookTitle="Book 1"
          bookCover="/cover.jpg"
        />,
      );

      expect(html).toContain('aria-label="Reader scroll progress"');
      expect(html).not.toContain('transition-[width]');
    } finally {
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('stores back-navigation positions by route and consumes them once', () => {
    const storage = new Map<string, string>();
    const sessionStorage = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    } as unknown as Storage;
    const key = readerScrollRestoreKey('/read/book-1/1');

    sessionStorage.setItem(key, '420');

    expect(loadReaderScrollRestoreY('/read/book-1/1', sessionStorage)).toBe(420);
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(key);
    expect(loadReaderScrollRestoreY('/read/book-1/1', sessionStorage)).toBeNull();
  });

  it('does not render for locked paywall chapters', () => {
    const html = renderToStaticMarkup(
      <ReaderContent
        chapter={lockedChapter}
        initialChapters={initialChapters}
        currentUrl="/read/book-1/1"
        bookTitle="Book 1"
        bookCover="/cover.jpg"
      />,
    );

    expect(html).toContain('data-testid="reader-paywall"');
    expect(html).not.toContain('aria-label="Reader scroll progress"');
  });
});

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
