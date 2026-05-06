'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';

import { useAuth } from '@/components/providers';
import { fetchReadingProgress, queryKeys } from '@/lib/queries';
import messages from '@/../messages/en.json';

export function ContinueReadingRail(): JSX.Element | null {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: queryKeys.readingProgress,
    queryFn: fetchReadingProgress,
    enabled: Boolean(user),
    retry: false,
  });

  if (!user || !data || data.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="px-4 text-lg font-semibold tracking-tight">{messages.home.continueReading}</h2>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto scroll-smooth px-4">
        {data.map((entry) => {
          const progressText = messages.home.progress
            .replaceAll('{chapterNumber}', () => entry.chapterNumber.toString())
            .replaceAll('{scrollPercent}', () => Math.round(entry.scrollPercent).toString());

          return (
            <Link
              key={`${entry.bookId}-${entry.chapterId}`}
              href={`/read/${entry.bookId}/${entry.chapterNumber}`}
              className="flex w-36 shrink-0 flex-col gap-2"
            >
              <div className="relative aspect-[3/4] w-36 overflow-hidden rounded-xl bg-muted">
                <Image src={entry.bookCover} alt="" fill sizes="144px" className="object-cover" />
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
