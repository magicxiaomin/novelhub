'use client';

import { Button } from '@/components/ui/button';
import { messages } from '@novelhub/shared';

export default function DramaWatchError({ reset }: { reset: () => void }): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
      <section className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-black">{messages.drama.playbackError}</h1>
        <p className="mt-3 text-sm text-white/70">{messages.errors.pleaseTryAgain}</p>
        <Button type="button" className="mt-5" onClick={reset}>
          {messages.drama.retryPlayback}
        </Button>
      </section>
    </main>
  );
}
