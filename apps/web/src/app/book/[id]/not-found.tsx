import Link from 'next/link';

export default function NotFound(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">Book not found</h1>
      <p className="text-sm text-muted-foreground">
        The book you&apos;re looking for might have been removed.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground"
      >
        Back to home
      </Link>
    </main>
  );
}
