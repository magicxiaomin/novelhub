'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import messages from '@/../messages/en.json';

/**
 * Description that clamps to 4 lines and expands on click. We always render
 * the full text — the `line-clamp-4` utility hides the overflow visually,
 * so copy/paste and screen readers see the whole thing.
 */
export function CollapsibleDescription({ text }: { text: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  // Avoid showing the toggle for short blurbs that don't actually overflow.
  const probablyClamps = text.length > 220;

  return (
    <div>
      <p
        className={cn(
          'whitespace-pre-line text-sm leading-6 text-foreground/90',
          !open && probablyClamps && 'line-clamp-4',
        )}
      >
        {text}
      </p>
      {probablyClamps ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-sm font-medium text-brand"
        >
          {open ? messages.book.showLess : messages.book.readMore}
        </button>
      ) : null}
    </div>
  );
}
