'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { loadAnonymousBookProgress } from '@/lib/anonymous-reading-progress';
import { messages } from '@novelhub/shared';

/**
 * Sticky bottom action on book detail. When the user is signed in we hide
 * the bottom-nav (since the CTA is at the bottom too); otherwise we sit
 * above the absent bottom-nav with the same vertical metrics.
 */
export function StickyStartReading({
  bookId,
  firstChapterOrder,
}: {
  bookId: string;
  firstChapterOrder: number;
}): JSX.Element {
  const { user } = useAuth();
  const [resumeChapterNumber, setResumeChapterNumber] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      setResumeChapterNumber(null);
      return;
    }

    try {
      setResumeChapterNumber(
        loadAnonymousBookProgress(window.localStorage, bookId)?.chapterNumber ?? null,
      );
    } catch {
      setResumeChapterNumber(null);
    }
  }, [bookId, user]);

  const offset = user ? 'bottom-16' : 'bottom-0';
  const chapterNumber = resumeChapterNumber ?? firstChapterOrder;
  const label = resumeChapterNumber
    ? messages.book.resumeChapter.replaceAll('{chapterNumber}', () =>
        resumeChapterNumber.toString(),
      )
    : messages.book.startReading;

  return (
    <StickyStartReadingContent
      bookId={bookId}
      chapterNumber={chapterNumber}
      label={label}
      offset={offset}
    />
  );
}

export function StickyStartReadingContent({
  bookId,
  chapterNumber,
  label,
  offset,
}: {
  bookId: string;
  chapterNumber: number;
  label: string;
  offset: 'bottom-0' | 'bottom-16';
}): JSX.Element {
  return (
    <div
      className={`fixed left-0 right-0 ${offset} z-20 mx-auto max-w-mobile bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75`}
    >
      <Button asChild className="h-12 w-full rounded-full text-base font-semibold">
        <Link href={`/read/${encodeURIComponent(bookId)}/${chapterNumber}`}>{label}</Link>
      </Button>
    </div>
  );
}
