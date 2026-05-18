'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { fetchBookChapters, queryKeys } from '@/lib/queries';
import type { ChapterSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

const CHAPTER_PAGE_LIMIT = 10;

export function ChapterList({
  bookId,
  chapters,
  totalChapters,
}: {
  bookId: string;
  chapters: ChapterSummary[];
  totalChapters: number;
}): JSX.Element {
  const [extraChapters, setExtraChapters] = useState<ChapterSummary[]>([]);
  const [pageToLoad, setPageToLoad] = useState<number | null>(null);
  const queryPage = pageToLoad ?? 2;
  const loaded = useMemo(() => {
    const byId = new Map<string, ChapterSummary>();
    for (const ch of [...chapters, ...extraChapters]) byId.set(ch.id, ch);
    return [...byId.values()].sort((a, b) => a.order - b.order);
  }, [chapters, extraChapters]);
  const hasMore = loaded.length < totalChapters;
  const chapterPage = useQuery({
    queryKey: queryKeys.bookChapters(bookId, queryPage, CHAPTER_PAGE_LIMIT),
    queryFn: () => fetchBookChapters(bookId, queryPage, CHAPTER_PAGE_LIMIT),
    enabled: pageToLoad !== null,
  });

  useEffect(() => {
    if (!chapterPage.data || pageToLoad === null) return;
    setExtraChapters((current) => {
      const byId = new Map<string, ChapterSummary>();
      for (const ch of [...current, ...chapterPage.data.items]) byId.set(ch.id, ch);
      return [...byId.values()].sort((a, b) => a.order - b.order);
    });
    setPageToLoad(null);
  }, [chapterPage.data, pageToLoad]);

  const loadMore = (): void => {
    if (chapterPage.isFetching) return;
    setPageToLoad(Math.floor(loaded.length / CHAPTER_PAGE_LIMIT) + 1);
  };

  return (
    <section>
      <h2 className="text-base font-semibold tracking-tight">{messages.book.chapters}</h2>
      {loaded.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed bg-card px-4 py-6 text-center">
          <p className="text-sm font-semibold">{messages.book.emptyChaptersTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{messages.book.emptyChaptersBody}</p>
        </div>
      ) : (
        <ol className="mt-3 divide-y rounded-2xl border bg-card">
          {loaded.map((ch) => (
            <li key={ch.id}>
              <Link
                href={`/read/${bookId}/${ch.order}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium">
                    {ch.order}. {ch.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ch.wordCount.toLocaleString()} {messages.book.wordsLower}
                  </p>
                </div>
                {ch.isFree ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {messages.book.free}
                  </span>
                ) : (
                  <Lock
                    className="h-4 w-4 text-muted-foreground"
                    aria-label={messages.book.locked}
                  />
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
      {chapterPage.isError ? (
        <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {messages.book.chaptersLoadError}
        </p>
      ) : null}
      {hasMore ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={chapterPage.isFetching}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border py-2 text-sm font-medium text-foreground/80 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {chapterPage.isFetching ? (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground"
              aria-hidden="true"
            />
          ) : null}
          {chapterPage.isFetching
            ? messages.book.loadingMoreChapters
            : messages.book.loadMoreChapters}
        </button>
      ) : null}
    </section>
  );
}
