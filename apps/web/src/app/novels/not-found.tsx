import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { messages } from '@novelhub/shared';

export default function NovelsNotFound(): JSX.Element {
  return (
    <AppShell>
      <section className="px-4 py-16 text-center">
        <div className="rounded-2xl border border-dashed p-8">
          <h1 className="text-2xl font-bold tracking-tight">{messages.errors.novelsNotFound}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{messages.errors.novelsNotFoundBody}</p>
          <Button asChild className="mt-6">
            <Link href="/">{messages.errors.backToHome}</Link>
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
