import { APP_NAME } from '@novelhub/shared';

import { Button } from '@/components/ui/button';
import messages from '../../messages/en.json';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <section className="rounded-[2rem] border bg-card/90 p-7 shadow-2xl shadow-secondary/10 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {messages.home.badge}
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-tight text-card-foreground">
          {messages.home.headline}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{messages.home.intro}</p>
        <Button className="mt-7 w-full" type="button">
          {messages.home.cta}
        </Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">{APP_NAME}</p>
      </section>
    </main>
  );
}
