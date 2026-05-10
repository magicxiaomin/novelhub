import { messages } from '@novelhub/shared';

export default function DramaWatchLoading(): JSX.Element {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
        <div className="h-10 w-28 animate-pulse rounded-full bg-white/10" />
        <section className="flex flex-1 items-center justify-center pb-10">
          <div className="aspect-[9/16] w-full max-w-[420px] animate-pulse rounded-[2rem] bg-white/10" />
        </section>
        <p className="pb-6 text-center text-sm text-white/60">{messages.drama.loading}</p>
      </div>
    </main>
  );
}
