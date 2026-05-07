'use client';

import { messages } from '@novelhub/shared';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">{messages.errors.somethingWrong}</h1>
      <p className="text-sm text-muted-foreground">
        {error.digest
          ? `${messages.errors.pleaseTryAgain} (${error.digest})`
          : messages.errors.pleaseTryAgain}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground"
      >
        {messages.errors.tryAgain}
      </button>
    </main>
  );
}
