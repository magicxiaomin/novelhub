import type { DramaSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

import { DramaCard } from './drama-card';

export function DramaRail({
  title,
  dramas,
}: {
  title: string;
  dramas: DramaSummary[];
}): JSX.Element {
  if (dramas.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{messages.drama.empty}</p>;
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
