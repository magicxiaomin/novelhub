'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { messages } from '@novelhub/shared';

export default function DramasError({ reset }: { reset: () => void }): JSX.Element {
  return (
    <AppShell>
      <main className="px-4 pt-8">
        <div className="rounded-3xl border bg-card p-5">
          <h1 className="text-xl font-semibold tracking-tight">{messages.errors.somethingWrong}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{messages.drama.browseError}</p>
          <Button type="button" className="mt-5 w-full" onClick={reset}>
            {messages.errors.tryAgain}
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
