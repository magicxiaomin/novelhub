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
import { useAuth } from '@/components/providers';
import {
  fetchBookChapters,
  fetchChapterReadingProgress,
  fetchUnlocks,
  queryKeys,
  saveReadingProgress,
} from '@/lib/queries';
import {
  DEFAULT_READER_SETTINGS,
  loadReaderSettings,
  saveReaderSettings,
  type ReaderSettings,
} from '@/lib/reader-settings';
import { cn } from '@/lib/utils';
import type { ChapterResponse, ChapterSummary, Paginated } from '@/lib/types';
import messages from '@/../messages/en.json';

const CHAPTER_LIMIT = 200;
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
  const [content, setContent] = useState<string | null>(null);
  const [contentError, setContentError] = useState(false);
  const lastScrollY = useRef(0);
  const restored = useRef(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlocks = useQuery({
    queryKey: queryKeys.unlocks(1, 1000),
    queryFn: () => fetchUnlocks(1, 1000),
    enabled: Boolean(user),
  });

  useEffect(() => {
    setSettings(loadReaderSettings(window.localStorage));
  }, []);

  useEffect(() => {
    saveReaderSettings(window.localStorage, settings);
  }, [settings]);

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
    let cancelled = false;
    setContent(null);
    setContentError(false);
    fetch(chapter.contentUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`content ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setContentError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chapter]);

  useEffect(() => {
    const onScroll = (): void => {
      const nextY = window.scrollY;
      const delta = nextY - lastScrollY.current;
      if (Math.abs(delta) > 6) setBarsVisible(delta < 0);
      lastScrollY.current = nextY;
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
    const save = (): void => {
      void persistProgress(chapter.bookId, chapter.id, chapter.chapterNumber);
    };
    const interval = window.setInterval(save, 5_000);
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') save();
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
      if (!bottom || autoAdvanceTimer.current) return;
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
        className="fixed bottom-[25dvh] left-[33vw] right-[33vw] top-[25dvh] z-20 cursor-default bg-transparent"
        aria-label={messages.reader.toggleControls}
        onClick={() => setBarsVisible((value) => !value)}
      />
      <article className="mx-auto max-w-mobile px-5 pb-28 pt-20">
        <h1 className="mb-8 text-2xl font-bold leading-tight">{chapter.title}</h1>
        {contentError ? (
          <p className="text-sm text-muted-foreground">{messages.reader.contentError}</p>
        ) : content === null ? (
          <p className="text-sm text-muted-foreground">{messages.reader.loadingContent}</p>
        ) : (
          <ChapterText content={content} />
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

async function persistProgress(
  bookId: string,
  chapterId: string,
  chapterNumber: number,
): Promise<void> {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const scrollPercent = Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)));
  const saved = await saveReadingProgress(bookId, chapterId, chapterNumber, scrollPercent);
  if (!saved && !warnedProgressUnavailable) {
    warnedProgressUnavailable = true;
    // eslint-disable-next-line no-console -- Expected temporary backend gap; warn once per session.
    console.warn(messages.reader.progressUnavailable);
    toast.error(messages.reader.progressUnavailable);
  }
}
