import { Suspense } from 'react';
import type { Metadata } from 'next';

import { Skeleton } from '@/components/ui/skeleton';
import messages from '@/../messages/en.json';

import { RechargeClient } from './recharge-client';

export const metadata: Metadata = {
  title: messages.recharge.title,
};

export default function RechargePage(): JSX.Element {
  return (
    <Suspense fallback={<RechargeFallback />}>
      <RechargeClient />
    </Suspense>
  );
}

function RechargeFallback(): JSX.Element {
  return (
    <main className="mx-auto min-h-dvh max-w-mobile px-5 py-6">
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="mt-4 h-64 rounded-lg" />
    </main>
  );
}
