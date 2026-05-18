import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import type { BookSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { messages } from '@novelhub/shared';

type Size = 'sm' | 'md';

const skeletonClass = 'bg-muted motion-safe:animate-pulse motion-reduce:animate-none';

const sizeClasses: Record<Size, { wrapper: string; cover: string; title: string }> = {
  sm: { wrapper: 'w-28', cover: 'aspect-[3/4] w-28', title: 'text-sm' },
  md: { wrapper: 'w-36', cover: 'aspect-[3/4] w-36', title: 'text-sm' },
};

const statusLabels: Record<string, string> = {
  completed: messages.book.statusCompleted,
  complete: messages.book.statusCompleted,
  ongoing: messages.book.statusOngoing,
  serializing: messages.book.statusOngoing,
};

function formatStatus(status: BookSummary['status'] | undefined): string | null {
  if (!status) {
    return null;
  }

  return statusLabels[status.trim().toLowerCase()] ?? null;
}

function formatChapterCount(count: BookSummary['totalChapters'] | undefined): string | null {
  if (typeof count !== 'number' || count <= 0) {
    return null;
  }

  const label = count === 1 ? messages.book.chapter : messages.book.chaptersLower;
  return `${count} ${label}`;
}

function formatFreeChapterCount(count: BookSummary['freeChapterCount'] | undefined): string | null {
  if (typeof count !== 'number' || count <= 0) {
    return null;
  }

  const label = count === 1 ? messages.book.freeChapter : messages.book.freeChapters;
  return `${count} ${label}`;
}

export function BookCardSkeleton({ size = 'md' }: { size?: Size } = {}): JSX.Element {
  const cls = sizeClasses[size];

  return (
    <div
      className={cn('flex shrink-0 flex-col gap-2', cls.wrapper)}
      aria-hidden="true"
      data-testid="book-card-skeleton"
    >
      <div className={cn('relative overflow-hidden rounded-xl', skeletonClass, cls.cover)} />
      <div className="flex flex-col gap-1">
        <div className={cn('h-8 rounded-md', skeletonClass)} />
        <div className={cn('h-3 w-20 rounded-md', skeletonClass)} />
        <div className="mt-1 flex gap-1">
          <div className={cn('h-5 w-10 rounded-full', skeletonClass)} />
          <div className={cn('h-5 w-12 rounded-full', skeletonClass)} />
        </div>
        <div className={cn('h-3 w-24 rounded-md', skeletonClass)} />
      </div>
    </div>
  );
}

export function BookCard({
  book,
  size = 'md',
  showCategory = true,
}: {
  book: BookSummary;
  size?: Size;
  showCategory?: boolean;
}): JSX.Element {
  const cls = sizeClasses[size];
  const tags = Array.isArray(book.tags) ? book.tags.filter(Boolean).slice(0, 2) : [];
  const status = formatStatus(book.status);
  const chapterCount = formatChapterCount(book.totalChapters);
  const freeChapterCount = formatFreeChapterCount(book.freeChapterCount);
  const hasMetadata =
    tags.length > 0 || status !== null || chapterCount !== null || freeChapterCount !== null;

  return (
    <Link
      href={`/book/${book.id}`}
      className={cn('flex shrink-0 flex-col gap-2', cls.wrapper)}
      aria-label={book.title}
    >
      <div className={cn('relative overflow-hidden rounded-xl bg-muted', cls.cover)}>
        <Image
          src={book.coverUrl}
          alt=""
          width={size === 'sm' ? 112 : 144}
          height={size === 'sm' ? 149 : 192}
          sizes={size === 'sm' ? '112px' : '144px'}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {showCategory ? (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 bg-black/55 text-white backdrop-blur"
          >
            {book.category}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <p className={cn('line-clamp-2 font-medium leading-tight', cls.title)}>{book.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
        {hasMetadata ? (
          <div className="flex flex-col gap-1 text-[11px] leading-none text-muted-foreground">
            {tags.length > 0 || status ? (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-1.5 py-1 text-foreground/80">
                    {tag}
                  </span>
                ))}
                {status ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-1 font-medium text-primary">
                    {status}
                  </span>
                ) : null}
              </div>
            ) : null}
            {chapterCount || freeChapterCount ? (
              <p className="line-clamp-1">
                {[chapterCount, freeChapterCount].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
