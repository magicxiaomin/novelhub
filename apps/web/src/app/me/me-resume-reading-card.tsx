import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { ReadingProgressEntry } from '@/lib/types';
import { messages } from '@novelhub/shared';

const fill = (template: string, values: Record<string, string>): string => {
  let result = template;
  for (const [token, value] of Object.entries(values)) {
    result = result.replaceAll(`{${token}}`, () => value);
  }
  return result;
};

export function MeResumeReadingCard({
  entries,
}: {
  entries: ReadingProgressEntry[];
}): JSX.Element | null {
  const resume = entries[0];

  if (!resume) return null;

  return (
    <Link
      href={`/read/${encodeURIComponent(resume.bookId)}/${resume.chapterNumber}`}
      className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {fill(messages.account.resumeReading, {
            bookTitle: resume.bookTitle,
            chapterNumber: String(resume.chapterNumber),
          })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {fill(messages.account.historyProgress, {
            chapterNumber: String(resume.chapterNumber),
            scrollPercent: String(Math.round(resume.scrollPercent)),
          })}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
