import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { messages } from '@novelhub/shared';

export default function DramaNotFound(): JSX.Element {
  return (
    <AppShell>
      <div className="px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{messages.drama.notFound}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{messages.drama.notFoundBody}</p>
        <Button asChild className="mt-6">
          <Link href="/">{messages.drama.backHome}</Link>
        </Button>
      </div>
    </AppShell>
  );
}
