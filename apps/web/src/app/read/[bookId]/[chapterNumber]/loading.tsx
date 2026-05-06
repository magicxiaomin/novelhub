import { Skeleton } from '@/components/ui/skeleton';

export default function ReaderLoading(): JSX.Element {
  return (
    <main className="mx-auto min-h-dvh max-w-mobile px-5 pb-12 pt-20">
      <Skeleton className="h-7 w-3/4" />
      <div className="mt-8 space-y-4">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-11/12" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-10/12" />
      </div>
    </main>
  );
}
