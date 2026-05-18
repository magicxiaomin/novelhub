import { BookCardSkeleton } from '@/components/book/book-card';
import { AppShell } from '@/components/layout/app-shell';
import { messages } from '@novelhub/shared';

export default function NovelsLoading(): JSX.Element {
  return (
    <AppShell>
      <main className="px-4 py-6" aria-label={messages.novels.loadingSkeletonLabel}>
        <div className="space-y-2">
          <div className="h-8 w-24 rounded-md bg-muted motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-72 max-w-full rounded-md bg-muted motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>

        <div className="mt-5 space-y-4">
          <div className="h-7 w-full rounded-full bg-muted motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-7 w-2/3 rounded-full bg-muted motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <BookCardSkeleton key={index} />
          ))}
        </div>
      </main>
    </AppShell>
  );
}
