import Link from 'next/link';
import { messages } from '@novelhub/shared';

export default function NotFound(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">{messages.errors.bookNotFound}</h1>
      <p className="text-sm text-muted-foreground">{messages.errors.bookNotFoundBody}</p>
      <Link
        href="/"
        className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground"
      >
        {messages.errors.backToHome}
      </Link>
    </main>
  );
}
