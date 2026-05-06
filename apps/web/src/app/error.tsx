'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    // Surface to wherever errors are aggregated. console.error is enough
    // until we wire Sentry (later ticket).
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{error.message || 'Please try again.'}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground"
      >
        Try again
      </button>
    </main>
  );
}
