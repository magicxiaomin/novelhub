import type { DramaSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

import { DramaCard } from './drama-card';

export function DramaRail({
  title,
  dramas,
  emptyMessage = messages.drama.empty,
  errorMessage,
}: {
  title: string;
  dramas: DramaSummary[];
  emptyMessage?: string;
  errorMessage?: string;
}): JSX.Element {
  if (errorMessage) {
    return (
      <section className="mt-6 px-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </p>
      </section>
    );
  }

  if (dramas.length === 0) {
    return (
      <section className="mt-6 px-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      </section>
    );
  }
  return (
    <section className="mt-6">
      <h2 className="px-4 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4">
        {dramas.map((drama, index) => (
          <div key={drama.id} className="w-40 shrink-0">
            <DramaCard drama={drama} priority={index < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}
