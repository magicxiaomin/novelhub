import { AppShell } from '@/components/layout/app-shell';
import { messages } from '@novelhub/shared';

export default function DramasLoading(): JSX.Element {
  return (
    <AppShell>
      <main className="px-4 pt-4">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-9 w-48 animate-pulse rounded bg-muted" />
        <p className="mt-4 text-sm text-muted-foreground">{messages.drama.loading}</p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="aspect-[2/3] animate-pulse rounded-2xl bg-muted" />
              <div className="h-4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
