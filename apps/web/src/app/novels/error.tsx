'use client';

import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { messages } from '@novelhub/shared';

export default function NovelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <AppShell>
      <section className="px-4 py-16 text-center">
        <div className="rounded-2xl border border-dashed p-8">
          <h1 className="text-2xl font-bold tracking-tight">{messages.errors.novelsRouteError}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.digest
              ? `${messages.errors.novelsRouteErrorBody} (${error.digest})`
              : messages.errors.novelsRouteErrorBody}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button type="button" onClick={reset}>
              {messages.errors.routeBoundaryReset}
            </Button>
            <Button asChild variant="outline">
              <Link href="/novels">{messages.errors.backToNovels}</Link>
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
