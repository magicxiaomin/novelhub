'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { useAuth } from '@/components/providers';
import { loadAnonymousReadingProgress } from '@/lib/anonymous-reading-progress';
import { fetchReadingProgress, queryKeys } from '@/lib/queries';
import type { ReadingProgressEntry } from '@/lib/types';
import { messages } from '@novelhub/shared';

const MAX_CONTINUE_READING_ENTRIES = 10;

export function ContinueReadingRail(): JSX.Element | null {
  const { user } = useAuth();
  const [anonymousEntries, setAnonymousEntries] = useState<ReadingProgressEntry[]>([]);
  const { data } = useQuery({
    queryKey: queryKeys.readingProgress,
    queryFn: fetchReadingProgress,
    enabled: Boolean(user),
    retry: false,
  });

  useEffect(() => {
    if (user) return;
    setAnonymousEntries(loadAnonymousReadingProgress(window.localStorage));
  }, [user]);

  if (user) {
    if (!data || data.length === 0) return null;
    return <ContinueReadingRailContent entries={data} />;
  }

  return <ContinueReadingRailContent entries={anonymousEntries} />;
}

export function ContinueReadingRailContent({
  entries,
}: {
  entries: ReadingProgressEntry[];
}): JSX.Element | null {
  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, MAX_CONTINUE_READING_ENTRIES);

  return (
    <section className="mt-6">
      <h2 className="px-4 text-lg font-semibold tracking-tight">{messages.home.continueReading}</h2>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto scroll-smooth px-4">
        {visibleEntries.map((entry) => {
          const progressText = messages.home.progress
            .replaceAll('{chapterNumber}', () => entry.chapterNumber.toString())
            .replaceAll('{scrollPercent}', () => Math.round(entry.scrollPercent).toString());

          return (
            <Link
              key={`${entry.bookId}-${entry.chapterId}`}
              href={`/read/${encodeURIComponent(entry.bookId)}/${entry.chapterNumber}`}
              className="flex w-36 shrink-0 flex-col gap-2"
            >
              <div className="relative aspect-[3/4] w-36 overflow-hidden rounded-xl bg-muted">
                <Image
                  src={entry.bookCover}
                  alt=""
                  fill
                  sizes="144px"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="line-clamp-2 text-sm font-medium leading-tight">{entry.bookTitle}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{progressText}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
