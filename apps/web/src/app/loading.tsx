import { Skeleton } from '@/components/ui/skeleton';

export default function Loading(): JSX.Element {
  return (
    <main className="mx-auto min-h-dvh max-w-mobile px-4 pt-4">
      <Skeleton className="aspect-[16/9] rounded-2xl" />
      <div className="mt-6">
        <Skeleton className="h-5 w-32" />
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-36 shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
