'use client';

import Link from 'next/link';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
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
  const offset = user ? 'bottom-16' : 'bottom-0';
  return (
    <div
      className={`fixed left-0 right-0 ${offset} z-20 mx-auto max-w-mobile bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75`}
    >
      <Button asChild className="h-12 w-full rounded-full text-base font-semibold">
        <Link href={`/read/${bookId}/${firstChapterOrder}`}>{messages.book.startReading}</Link>
      </Button>
    </div>
  );
}
