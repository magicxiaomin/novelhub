'use client';

import { Lock, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChapterSummary } from '@/lib/types';
import messages from '@/../messages/en.json';

export function ChapterListDrawer({
  open,
  bookId,
  currentChapterId,
  chapters,
  unlockedChapterIds,
  isAnonymous,
  onClose,
}: {
  open: boolean;
  bookId: string;
  currentChapterId: string;
  chapters: ChapterSummary[];
  unlockedChapterIds: Set<string>;
  isAnonymous: boolean;
  onClose: () => void;
}): JSX.Element {
  const router = useRouter();

  const navigate = (order: number): void => {
    onClose();
    router.push(`/read/${bookId}/${order}`);
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/35 transition-opacity',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
    >
      <aside
        className={cn(
          'absolute bottom-0 right-0 top-0 flex w-[85vw] max-w-mobile flex-col bg-background text-foreground shadow-2xl transition-transform',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={messages.reader.chapters}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">{messages.reader.chapters}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            aria-label={messages.reader.drawerClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ol className="min-h-0 flex-1 overflow-y-auto">
          {chapters.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              {messages.reader.noChapters}
            </li>
          ) : null}
          {chapters.map((chapter) => {
            const locked = !chapter.isFree && (isAnonymous || !unlockedChapterIds.has(chapter.id));
            const current = chapter.id === currentChapterId;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => navigate(chapter.order)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b px-4 py-3 text-left active:bg-muted',
                    current ? 'bg-brand/10 text-brand' : 'text-foreground',
                  )}
                >
                  <span className="w-8 shrink-0 text-sm font-semibold tabular-nums">
                    {chapter.order}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {chapter.title}
                  </span>
                  {locked ? (
                    <Lock
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-label={messages.reader.locked}
                    />
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {chapter.isFree ? messages.reader.free : messages.reader.unlocked}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
