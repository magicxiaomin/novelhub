'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Lock } from 'lucide-react';

import type { ChapterSummary } from '@/lib/types';

const INITIAL_VISIBLE = 10;

export function ChapterList({
  bookId,
  chapters,
  totalChapters,
}: {
  bookId: string;
  chapters: ChapterSummary[];
  totalChapters: number;
}): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? chapters : chapters.slice(0, INITIAL_VISIBLE);
  const hasMore = chapters.length > INITIAL_VISIBLE || totalChapters > chapters.length;

  return (
    <section>
      <h2 className="text-base font-semibold tracking-tight">Chapters</h2>
      <ol className="mt-3 divide-y rounded-2xl border bg-card">
        {visible.map((ch) => (
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
                  {ch.wordCount.toLocaleString()} words
                </p>
              </div>
              {ch.isFree ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Free
                </span>
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked" />
              )}
            </Link>
          </li>
        ))}
      </ol>
      {hasMore && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-full border py-2 text-sm font-medium text-foreground/80"
        >
          View all {totalChapters} chapters
        </button>
      ) : null}
    </section>
  );
}
