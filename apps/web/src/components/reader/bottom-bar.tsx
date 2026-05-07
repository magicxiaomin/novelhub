'use client';

import { ChevronLeft, ChevronRight, List, Settings } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { messages } from '@novelhub/shared';

export function ReaderBottomBar({
  visible,
  prevHref,
  nextHref,
  onChapters,
  onSettings,
}: {
  visible: boolean;
  prevHref: string | null;
  nextHref: string | null;
  onChapters: () => void;
  onSettings: () => void;
}): JSX.Element {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-2 backdrop-blur transition-transform',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
      aria-label={messages.reader.chapters}
    >
      <div className="mx-auto grid max-w-mobile grid-cols-4 gap-2">
        <BarLink href={prevHref} label={messages.reader.previousChapter}>
          <ChevronLeft className="h-5 w-5" />
        </BarLink>
        <BarButton label={messages.reader.chapters} onClick={onChapters}>
          <List className="h-5 w-5" />
        </BarButton>
        <BarButton label={messages.reader.settings} onClick={onSettings}>
          <Settings className="h-5 w-5" />
        </BarButton>
        <BarLink href={nextHref} label={messages.reader.nextChapter}>
          <ChevronRight className="h-5 w-5" />
        </BarLink>
      </div>
    </nav>
  );
}

function BarButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-11 place-items-center rounded-lg active:bg-muted"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function BarLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}): JSX.Element {
  if (!href) {
    return (
      <span
        className="grid h-11 place-items-center rounded-lg text-muted-foreground opacity-50"
        aria-label={label}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="grid h-11 place-items-center rounded-lg active:bg-muted"
      aria-label={label}
    >
      {children}
    </Link>
  );
}
