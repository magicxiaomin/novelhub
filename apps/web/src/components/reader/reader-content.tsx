'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  fetchBookChapters,
  fetchChapterReadingProgress,
  fetchUnlocks,
  queryKeys,
  saveReadingProgress,
} from '@/lib/queries';
import { incrementChaptersReadCount } from '@/lib/read-count';
import {
  DEFAULT_READER_SETTINGS,
  loadReaderSettings,
  saveReaderSettings,
  type ReaderSettings,
} from '@/lib/reader-settings';
import { cn } from '@/lib/utils';
import type { ChapterResponse, ChapterSummary, Paginated } from '@/lib/types';
import { messages } from '@novelhub/shared';

const CHAPTER_LIMIT = 200;
const MIN_PROGRESS_DELTA_PX = 8;
let warnedProgressUnavailable = false;

export function ReaderContent({
  chapter,
  initialChapters,
  currentUrl,
}: {
  chapter: ChapterResponse;
  initialChapters: Paginated<ChapterSummary>;
  currentUrl: string;
}): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [barsVisible, setBarsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [chapters, setChapters] = useState<ChapterSummary[]>(initialChapters.items);
  const lastToolbarScrollY = useRef(0);
  const lastPersistedScrollY = useRef(0);
  const restored = useRef(false);
  const countedRead = useRef(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlocks = useQuery({
    queryKey: queryKeys.unlocks(1, 1000),
    queryFn: () => fetchUnlocks(1, 1000),
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
    setSettings(loadReaderSettings(window.localStorage));
  }, []);

  useEffect(() => {
    saveReaderSettings(window.localStorage, settings);
  }, [settings]);

  useEffect(() => {
    if (countedRead.current || !contentQuery.isSuccess || !contentQuery.data) return;
    countedRead.current = true;
    incrementChaptersReadCount();
  }, [contentQuery.data, contentQuery.isSuccess]);

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
    const onScroll = (): void => {
      const nextY = window.scrollY;
      const delta = nextY - lastToolbarScrollY.current;
      if (Math.abs(delta) > 6) setBarsVisible(delta < 0);
      lastToolbarScrollY.current = nextY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (chapter.isLocked || !user || restored.current) return;
    restored.current = true;
    fetchChapterReadingProgress(chapter.bookId, chapter.id)
      .then((progress) => {
        if (!progress) return;
        window.requestAnimationFrame(() => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: Math.max(0, maxScroll * (progress.scrollPercent / 100)) });
        });
      })
      .catch(() => undefined);
  }, [chapter, user]);

  useEffect(() => {
    if (chapter.isLocked || !user) return;
    lastPersistedScrollY.current = window.scrollY;
    const save = async (): Promise<void> => {
      const scrollY = window.scrollY;
      if (await persistProgress(chapter.id)) {
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
  }, [chapter, user]);

  const nextHref = useMemo(() => {
    if (chapter.isLocked) return null;
    return hrefForChapterId(chapter.bookId, chapters, chapter.nextChapterId);
  }, [chapter, chapters]);
  const prevHref = useMemo(() => {
    if (chapter.isLocked) return null;
    return hrefForChapterId(chapter.bookId, chapters, chapter.prevChapterId);
  }, [chapter, chapters]);

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
      autoAdvanceTimer.current = setTimeout(() => router.push(nextHref), 1_200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (autoAdvanceTimer.current) window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    };
  }, [chapter, nextHref, router, settings.autoAdvance]);

  if (chapter.isLocked) {
    return <Paywall chapter={chapter} currentUrl={currentUrl} onDismiss={() => router.back()} />;
  }

  const unlockedChapterIds = new Set(unlocks.data?.items.map((unlock) => unlock.chapterId) ?? []);
  const readerStyle = styleForSettings(settings);

  return (
    <main className={cn('min-h-dvh touch-pan-y', readerStyle.className)} style={readerStyle.style}>
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
              <Link href={nextHref}>{messages.reader.nextChapter}</Link>
            </Button>
          </div>
        ) : null}
      </article>
      <ReaderBottomBar
        visible={barsVisible}
        prevHref={prevHref}
        nextHref={nextHref}
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

function styleForSettings(settings: ReaderSettings): {
  className: string;
  style: CSSProperties;
} {
  const theme =
    settings.theme === 'dark'
      ? 'bg-[#1A1A1A] text-[#E8E8E8]'
      : settings.theme === 'sepia'
        ? 'bg-[#F5EFE0] text-[#211A13]'
        : 'bg-white text-[#171717]';
  const fontSize = { s: 15, m: 17, l: 19, xl: 22 }[settings.fontSize];
  const lineHeight = { compact: 1.5, default: 1.7, loose: 1.9 }[settings.lineHeight];
  return {
    className: cn(theme, settings.fontFamily === 'serif' ? 'font-serif' : 'font-sans'),
    style: { fontSize, lineHeight },
  };
}

async function persistProgress(chapterId: string): Promise<boolean> {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const scrollPercent = Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)));
  const saved = await saveReadingProgress(chapterId, scrollPercent);
  if (!saved && !warnedProgressUnavailable) {
    warnedProgressUnavailable = true;
    toast.error(messages.reader.progressUnavailable);
  }
  return saved;
}

async function fetchChapterContent(contentUrl: string): Promise<string> {
  const url = new URL(contentUrl);
  if (url.protocol !== 'https:' || !isAllowedChapterContentHost(url.hostname)) {
    throw new Error('chapter content host is not allowed');
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new ChapterContentError(res.status);
  return res.text();
}

class ChapterContentError extends Error {
  constructor(readonly status: number) {
    super(`content ${status}`);
  }
}

function isAllowedChapterContentHost(hostname: string): boolean {
  const allowedHosts = new Set<string>();
  const apiHost = hostFromEnvUrl(process.env.NEXT_PUBLIC_API_URL);
  const r2Host = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;
  if (apiHost) allowedHosts.add(apiHost);
  if (r2Host) allowedHosts.add(r2Host);
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
