'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { messages } from '@novelhub/shared';

export function ReaderTopBar({
  title,
  visible,
  onSettings,
}: {
  title: string;
  visible: boolean;
  onSettings: () => void;
}): JSX.Element {
  const router = useRouter();

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b bg-background/95 px-3 py-2 backdrop-blur transition-transform',
        visible ? 'translate-y-0' : '-translate-y-full',
      )}
    >
      <div className="mx-auto flex max-w-mobile items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={messages.reader.back}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full active:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
        <button
          type="button"
          onClick={onSettings}
          aria-label={messages.reader.settings}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full active:bg-muted"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
