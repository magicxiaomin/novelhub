'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';

import { Paywall } from '@/components/paywall/paywall';
import { ReaderBottomBar } from '@/components/reader/bottom-bar';
import { ChapterListDrawer } from '@/components/reader/chapter-list-drawer';
import { SettingsDrawer } from '@/components/reader/settings-drawer';
import { ReaderTopBar } from '@/components/reader/top-bar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/providers';
import {
  loadAnonymousChapterProgress,
  saveAnonymousReadingProgress,
} from '@/lib/anonymous-reading-progress';
import {
  fetchBookChapters,
  fetchChapterReadingProgress,
  fetchUnlocks,
  queryKeys,
  saveReadingProgress,
} from '@/lib/queries';
import { incrementChaptersReadCount } from '@/lib/read-count';
import {
  DEFAULT_READER_SETTINGS,
  applyReaderSettingsToDocument,
  saveReaderSettings,
  type ReaderSettings,
} from '@/lib/reader-settings';
import { cn } from '@/lib/utils';
import type { ChapterResponse, ChapterSummary, Paginated } from '@/lib/types';
import { messages } from '@novelhub/shared';

const CHAPTER_LIMIT = 200;
const MIN_PROGRESS_DELTA_PX = 8;
const READER_SCROLL_RESTORE_PREFIX = 'novelhub:reader-scroll:';
let warnedProgressUnavailable = false;

type AdjacentPrefetchRouter = {
  prefetch: (href: string) => void;
};

export function ReaderContent({
  chapter,
  initialChapters,
  currentUrl,
  bookTitle,
  bookCover,
}: {
  chapter: ChapterResponse;
  initialChapters: Paginated<ChapterSummary>;
  currentUrl: string;
  bookTitle: string;
  bookCover: string;
}): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [barsVisible, setBarsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_READER_SETTINGS;
    return applyReaderSettingsToDocument(document, window.localStorage);
  });
  const [chapters, setChapters] = useState<ChapterSummary[]>(initialChapters.items);
  const lastToolbarScrollY = useRef(0);
  const lastPersistedScrollY = useRef(0);
  const restoredChapterId = useRef<string | null>(null);
  const countedReadChapterId = useRef<string | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedAdjacentHrefs = useRef(new Set<string>());
  const navigatingReaderRoute = useRef(false);
  const restoringReaderRoute = useRef(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Scope the unlock fetch to the current book so a heavy reader (>1000
  // unlocks across the catalog) doesn't have later chapters of THIS book
  // misclassified as locked because they fell off the first page.
  const unlocks = useQuery({
    queryKey: queryKeys.unlocks(1, 200, chapter.bookId),
    queryFn: () => fetchUnlocks(1, 200, chapter.bookId),
    enabled: Boolean(user),
  });
  const contentQuery = useQuery({
    queryKey: queryKeys.chapterContent(chapter.id),
    queryFn: () => {
      if (chapter.isLocked) throw new Error('Locked chapter has no content URL');
      return fetchChapterContent(chapter.contentUrl);
    },
    enabled: !chapter.isLocked,
    retry: (count, err) => {
      if (err instanceof ChapterContentError && err.status >= 400 && err.status < 500) {
        return false;
      }
      return count < 1;
    },
  });

  useEffect(() => {
    saveReaderSettings(window.localStorage, settings);
    applyReaderSettingsToDocument(document, window.localStorage);
  }, [settings]);

  useEffect(() => {
    if (
      countedReadChapterId.current === chapter.id ||
      !contentQuery.isSuccess ||
      !contentQuery.data
    )
      return;
    countedReadChapterId.current = chapter.id;
    incrementChaptersReadCount();
  }, [chapter.id, contentQuery.data, contentQuery.isSuccess]);

  useEffect(() => {
    let cancelled = false;
    async function loadRemaining(): Promise<void> {
      const pages = Math.ceil(initialChapters.total / CHAPTER_LIMIT);
      for (let page = 2; page <= pages; page += 1) {
        const next = await fetchBookChapters(chapter.bookId, page, CHAPTER_LIMIT);
        if (cancelled) return;
        setChapters((current) => mergeChapters(current, next.items));
      }
    }
    void loadRemaining();
    return () => {
      cancelled = true;
    };
  }, [chapter.bookId, initialChapters.total]);

  useEffect(() => {
    if (chapter.isLocked) return;
    const updateProgress = (): void => {
      setScrollProgress(
        calculateReaderScrollProgress({
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
        }),
      );
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [chapter.isLocked]);

  useEffect(() => {
    navigatingReaderRoute.current = false;
    restoringReaderRoute.current = true;
    restoredChapterId.current = null;
    const restoreY =
      loadReaderMemoryScrollRestoreY(currentUrl) ??
      loadReaderHistoryScrollRestoreY(currentUrl) ??
      loadReaderScrollRestoreY(currentUrl, window.sessionStorage);
    if (restoreY !== null) {
      (window as typeof window & { __novelhubReaderRestoreY?: number }).__novelhubReaderRestoreY =
        restoreY;
      restoreReaderScrollY(restoreY, undefined, currentUrl);
    }
  }, [currentUrl]);

  useEffect(() => {
    const onScroll = (): void => {
      const nextY = window.scrollY;
      if (
        !chapter.isLocked &&
        !navigatingReaderRoute.current &&
        !restoringReaderRoute.current &&
        window.location.pathname === currentUrl
      ) {
        writeReaderScrollRestoreY(currentUrl, nextY);
      }
      const delta = nextY - lastToolbarScrollY.current;
      if (Math.abs(delta) > 6) setBarsVisible(delta < 0);
      lastToolbarScrollY.current = nextY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [chapter.isLocked, currentUrl]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const restoreAfterHistoryNavigation = (): void => {
      const path = window.location.pathname;
      const restoreY =
        loadReaderMemoryScrollRestoreY(path) ??
        loadReaderHistoryScrollRestoreY(path) ??
        peekReaderScrollRestoreY(path, window.sessionStorage);
      if (restoreY === null) return;
      (window as typeof window & { __novelhubReaderRestoreY?: number }).__novelhubReaderRestoreY =
        restoreY;
      restoreReaderScrollY(restoreY, undefined, path);
    };
    const onHistoryNavigation = (): void => {
      window.setTimeout(restoreAfterHistoryNavigation, 0);
    };
    window.addEventListener('popstate', onHistoryNavigation);
    return () => {
      window.removeEventListener('popstate', onHistoryNavigation);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    // Wait for chapter text to render before scrolling — without this gate,
    // requestAnimationFrame fires while document.documentElement.scrollHeight
    // is still the skeleton height and the percent-to-y mapping lands at
    // the wrong y-position.
    if (chapter.isLocked || restoredChapterId.current === chapter.id) return;
    if (!contentQuery.isSuccess || !contentQuery.data) return;
    restoredChapterId.current = chapter.id;
    const progressPromise = user
      ? fetchChapterReadingProgress(chapter.bookId, chapter.id)
      : Promise.resolve(
          loadAnonymousChapterProgress(window.localStorage, chapter.bookId, chapter.id),
        );
    progressPromise
      .then((progress) => {
        const restoredScrollY =
          (window as typeof window & { __novelhubReaderRestoreY?: number })
            .__novelhubReaderRestoreY ??
          loadReaderScrollRestoreY(currentUrl, window.sessionStorage);
        delete (window as typeof window & { __novelhubReaderRestoreY?: number })
          .__novelhubReaderRestoreY;
        if (restoredScrollY !== null) {
          window.requestAnimationFrame(() => {
            restoreReaderScrollY(
              restoredScrollY,
              () => {
                restoringReaderRoute.current = false;
              },
              currentUrl,
            );
          });
          return;
        }
        if (!progress) {
          restoringReaderRoute.current = false;
          return;
        }
        window.requestAnimationFrame(() => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: Math.max(0, maxScroll * (progress.scrollPercent / 100)) });
          restoringReaderRoute.current = false;
        });
      })
      .catch(() => {
        restoringReaderRoute.current = false;
      });
  }, [chapter, user, contentQuery.isSuccess, contentQuery.data, currentUrl]);

  useEffect(() => {
    if (chapter.isLocked) return;
    lastPersistedScrollY.current = window.scrollY;
    const save = async (): Promise<void> => {
      const scrollY = window.scrollY;
      if (await persistProgress(chapter, Boolean(user), bookTitle, bookCover)) {
        lastPersistedScrollY.current = scrollY;
      }
    };
    const check = (): void => {
      if (Math.abs(window.scrollY - lastPersistedScrollY.current) >= MIN_PROGRESS_DELTA_PX) {
        void save();
      }
    };
    const interval = window.setInterval(check, 5_000);
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') void save();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [chapter, user, bookTitle, bookCover]);

  const nextHref = useMemo(() => {
    if (chapter.isLocked) return null;
    return hrefForChapterId(chapter.bookId, chapters, chapter.nextChapterId);
  }, [chapter, chapters]);
  const prevHref = useMemo(() => {
    if (chapter.isLocked) return null;
    return hrefForChapterId(chapter.bookId, chapters, chapter.prevChapterId);
  }, [chapter, chapters]);

  useEffect(() => {
    prefetchAdjacentReaderRoutes(router, {
      prevHref: prefetchedAdjacentHrefs.current.has(prevHref ?? '') ? null : prevHref,
      nextHref: prefetchedAdjacentHrefs.current.has(nextHref ?? '') ? null : nextHref,
    });
    if (!isReducedDataPreferred()) {
      if (prevHref) prefetchedAdjacentHrefs.current.add(prevHref);
      if (nextHref) prefetchedAdjacentHrefs.current.add(nextHref);
    }
  }, [nextHref, prevHref, router]);

  useEffect(() => {
    if (chapter.isLocked || !settings.autoAdvance || !nextHref) return;
    const onScroll = (): void => {
      const bottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (!bottom) {
        if (autoAdvanceTimer.current) {
          window.clearTimeout(autoAdvanceTimer.current);
          autoAdvanceTimer.current = null;
        }
        return;
      }
      if (autoAdvanceTimer.current) return;
      autoAdvanceTimer.current = setTimeout(() => {
        navigatingReaderRoute.current = true;
        navigateReaderRoute(router, currentUrl, nextHref);
      }, 1_200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    };
  }, [chapter, currentUrl, nextHref, router, settings.autoAdvance]);

  if (chapter.isLocked) {
    return <Paywall chapter={chapter} currentUrl={currentUrl} onDismiss={() => router.back()} />;
  }

  const unlockedChapterIds = new Set(unlocks.data?.items.map((unlock) => unlock.chapterId) ?? []);
  const readerStyle = styleForSettings(settings);

  return (
    <main className={cn('min-h-dvh touch-pan-y', readerStyle.className)} style={readerStyle.style}>
      <ReaderScrollProgress progress={scrollProgress} />
      <ReaderTopBar
        title={chapter.title}
        visible={barsVisible}
        onSettings={() => setSettingsOpen(true)}
      />
      <button
        type="button"
        className="fixed bottom-[44dvh] left-0 right-0 top-[44dvh] z-20 cursor-default bg-transparent"
        aria-label={messages.reader.toggleControls}
        onClick={() => setBarsVisible((value) => !value)}
      />
      <article className="mx-auto max-w-mobile px-5 pb-28 pt-20">
        <h1 className="mb-8 text-2xl font-bold leading-tight">{chapter.title}</h1>
        {contentQuery.isError ? (
          <p className="text-sm text-muted-foreground">{messages.reader.contentError}</p>
        ) : contentQuery.isLoading ? (
          <ChapterTextSkeleton />
        ) : (
          <ChapterText content={contentQuery.data ?? ''} />
        )}
        {nextHref ? (
          <div className="pt-8 text-center">
            <Button asChild className="bg-brand px-8 text-brand-foreground hover:bg-brand/90">
              <Link
                href={nextHref}
                onClick={() => {
                  navigatingReaderRoute.current = true;
                  saveReaderScrollRestoreY(currentUrl, nextHref);
                }}
              >
                {messages.reader.nextChapter}
              </Link>
            </Button>
          </div>
        ) : null}
      </article>
      <ReaderBottomBar
        visible={barsVisible}
        prevHref={prevHref}
        nextHref={nextHref}
        onNavigate={(href) => {
          navigatingReaderRoute.current = true;
          saveReaderScrollRestoreY(currentUrl, href);
        }}
        onChapters={() => setChaptersOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />
      <ChapterListDrawer
        open={chaptersOpen}
        bookId={chapter.bookId}
        currentChapterId={chapter.id}
        chapters={chapters}
        unlockedChapterIds={unlockedChapterIds}
        isAnonymous={!user}
        onClose={() => setChaptersOpen(false)}
      />
    </main>
  );
}

function ReaderScrollProgress({ progress }: { progress: number }): JSX.Element {
  return (
    <div
      aria-label={messages.reader.scrollProgress}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={progress}
      className="fixed left-0 right-0 top-0 z-50 h-1 bg-transparent"
      role="progressbar"
    >
      <div
        className={cn(
          'h-full bg-brand',
          isReducedMotionPreferred() ? '' : 'transition-[width] duration-150 ease-out',
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function calculateReaderScrollProgress({
  scrollY,
  scrollHeight,
  innerHeight,
}: {
  scrollY: number;
  scrollHeight: number;
  innerHeight: number;
}): number {
  const maxScroll = scrollHeight - innerHeight;
  if (maxScroll <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((scrollY / maxScroll) * 100)));
}

export function isReducedMotionPreferred(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function readerScrollRestoreKey(path: string): string {
  return `${READER_SCROLL_RESTORE_PREFIX}${path}`;
}

export function loadReaderScrollRestoreY(path: string, storage: Storage): number | null {
  const key = readerScrollRestoreKey(path);
  const scrollY = peekReaderScrollRestoreY(path, storage);
  storage.removeItem(key);
  storage.removeItem(`${key}:last`);
  return scrollY;
}

function peekReaderScrollRestoreY(path: string, storage: Storage): number | null {
  const key = readerScrollRestoreKey(path);
  const value = storage.getItem(key) ?? storage.getItem(`${key}:last`);
  if (value === null) return null;
  const scrollY = Number(value);
  return Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : null;
}

function saveReaderScrollRestoreY(path: string, nextPath?: string): void {
  writeReaderScrollRestoreY(path, window.scrollY);
  if (nextPath) {
    const nextKey = readerScrollRestoreKey(nextPath);
    if (window.sessionStorage.getItem(nextKey) === null) {
      window.sessionStorage.setItem(nextKey, '0');
    }
  }
}

function writeReaderScrollRestoreY(path: string, scrollY: number): void {
  const key = readerScrollRestoreKey(path);
  const nextScrollY = Math.max(0, Math.round(scrollY));
  const value = String(Number.isFinite(nextScrollY) ? nextScrollY : 0);
  window.sessionStorage.setItem(key, value);
  window.sessionStorage.setItem(`${key}:last`, value);
  if (window.location.pathname === path) {
    writeReaderMemoryScrollRestoreY(path, nextScrollY);
    const state = isRecord(window.history.state) ? window.history.state : {};
    window.history.replaceState(
      {
        ...state,
        __novelhubReaderScrollRestorePath: path,
        __novelhubReaderScrollRestoreY: nextScrollY,
      },
      '',
      path,
    );
  }
}

function loadReaderHistoryScrollRestoreY(path: string): number | null {
  const state = window.history.state;
  if (!isRecord(state) || state.__novelhubReaderScrollRestorePath !== path) return null;
  const scrollY = Number(state.__novelhubReaderScrollRestoreY);
  return Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : null;
}

function loadReaderMemoryScrollRestoreY(path: string): number | null {
  const scrolls = (
    window as typeof window & { __novelhubReaderScrollRestores?: Record<string, number> }
  ).__novelhubReaderScrollRestores;
  const scrollY = scrolls?.[path] ?? null;
  return scrollY !== null && Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : null;
}

function writeReaderMemoryScrollRestoreY(path: string, scrollY: number): void {
  const target = window as typeof window & {
    __novelhubReaderScrollRestores?: Record<string, number>;
  };
  target.__novelhubReaderScrollRestores = {
    ...(target.__novelhubReaderScrollRestores ?? {}),
    [path]: scrollY,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clampReaderScrollY(scrollY: number): number {
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(maxScroll, Math.max(0, scrollY));
}

function restoreReaderScrollY(scrollY: number, onDone?: () => void, path?: string): void {
  let attempts = 0;
  const restoreWhenScrollable = (): void => {
    if (path && window.location.pathname !== path) {
      onDone?.();
      return;
    }
    attempts += 1;
    window.scrollTo({ top: clampReaderScrollY(scrollY) });
    if (attempts >= 20) {
      onDone?.();
      return;
    }
    window.setTimeout(restoreWhenScrollable, 50);
  };
  window.setTimeout(restoreWhenScrollable, 0);
}

function navigateReaderRoute(
  router: { push: (href: string) => void },
  currentUrl: string,
  href: string,
): void {
  saveReaderScrollRestoreY(currentUrl, href);
  router.push(href);
}

function ChapterText({ content }: { content: string }): JSX.Element {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    <div className="space-y-[1em]">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function ChapterTextSkeleton(): JSX.Element {
  return (
    <div aria-label={messages.reader.loadingContent} className="space-y-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[92%]" />
      <Skeleton className="h-4 w-[96%]" />
      <Skeleton className="h-4 w-[82%]" />
      <Skeleton className="h-4 w-[88%]" />
      <Skeleton className="h-4 w-[64%]" />
    </div>
  );
}

function mergeChapters(current: ChapterSummary[], incoming: ChapterSummary[]): ChapterSummary[] {
  const byId = new Map<string, ChapterSummary>();
  for (const chapter of [...current, ...incoming]) byId.set(chapter.id, chapter);
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

function hrefForChapterId(
  bookId: string,
  chapters: ChapterSummary[],
  chapterId: string | null,
): string | null {
  if (!chapterId) return null;
  const chapter = chapters.find((item) => item.id === chapterId);
  return chapter ? `/read/${bookId}/${chapter.order}` : null;
}

export function prefetchAdjacentReaderRoutes(
  router: AdjacentPrefetchRouter,
  hrefs: { prevHref: string | null; nextHref: string | null },
): void {
  if (isReducedDataPreferred()) return;
  if (hrefs.prevHref) router.prefetch(hrefs.prevHref);
  if (hrefs.nextHref) router.prefetch(hrefs.nextHref);
}

function isReducedDataPreferred(): boolean {
  const navigatorWithConnection = globalThis.navigator as
    | (Navigator & { connection?: { saveData?: boolean } })
    | undefined;
  if (navigatorWithConnection?.connection?.saveData === true) return true;
  return globalThis.matchMedia?.('(prefers-reduced-data: reduce)').matches === true;
}

function styleForSettings(settings: ReaderSettings): {
  className: string;
  style: CSSProperties;
} {
  return {
    className: cn(
      'bg-[var(--reader-bg)] text-[var(--reader-fg)]',
      settings.fontFamily === 'serif' ? 'font-serif' : 'font-sans',
    ),
    style: {
      fontSize: 'var(--reader-font-size)',
      lineHeight: 'var(--reader-line-height)',
      fontFamily: 'var(--reader-font-family)',
    },
  };
}

async function persistProgress(
  chapter: ChapterResponse,
  isAuthenticated: boolean,
  bookTitle: string,
  bookCover: string,
): Promise<boolean> {
  if (chapter.isLocked) return false;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const scrollPercent = Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)));
  if (!isAuthenticated) {
    saveAnonymousReadingProgress(window.localStorage, {
      bookId: chapter.bookId,
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      scrollPercent,
      bookTitle,
      bookCover,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }
  const saved = await saveReadingProgress(chapter.id, scrollPercent);
  if (!saved && !warnedProgressUnavailable) {
    warnedProgressUnavailable = true;
    toast.error(messages.reader.progressUnavailable);
  }
  return saved;
}

async function fetchChapterContent(contentUrl: string): Promise<string> {
  const url = new URL(contentUrl);
  if (
    !isAllowedChapterContentProtocol(url.protocol) ||
    !isAllowedChapterContentHost(url.hostname)
  ) {
    throw new Error('chapter content host is not allowed');
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new ChapterContentError(res.status);
  return res.text();
}

function isAllowedChapterContentProtocol(protocol: string): boolean {
  // Match the deployed API's protocol so an http:// dev server can serve
  // chapter content. Production sets NEXT_PUBLIC_API_URL to https://, which
  // keeps the strict https-only rule.
  const apiProtocol = protocolFromEnvUrl(process.env.NEXT_PUBLIC_API_URL);
  if (apiProtocol === 'http:') return protocol === 'http:' || protocol === 'https:';
  return protocol === 'https:';
}

function protocolFromEnvUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
}

class ChapterContentError extends Error {
  constructor(readonly status: number) {
    super(`content ${status}`);
  }
}

function isAllowedChapterContentHost(hostname: string): boolean {
  // Production: only the R2 public host is allowed. Chapter content lives in
  // R2 and shouldn't ever come from the API (which signs the URL but doesn't
  // serve the bytes). Permitting the API host re-opens an SSRF/proxy class
  // of bug per AGENTS.md.
  const allowedHosts = new Set<string>();
  const r2Host = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;
  if (r2Host) allowedHosts.add(r2Host);

  // Dev escape hatch: when R2 isn't configured locally, the API serves the
  // seeded chapter text from `/static/chapters/...`. Set
  // NEXT_PUBLIC_DEV_ALLOW_API_CONTENT=true in `.env` to opt in. Production
  // must NOT set this — it bypasses the host hardening above.
  if (process.env.NEXT_PUBLIC_DEV_ALLOW_API_CONTENT === 'true') {
    const apiHost = hostFromEnvUrl(process.env.NEXT_PUBLIC_API_URL);
    if (apiHost) allowedHosts.add(apiHost);
  }

  return allowedHosts.has(hostname);
}

function hostFromEnvUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
