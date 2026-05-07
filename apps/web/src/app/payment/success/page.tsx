import { Suspense } from 'react';

import { PaymentSuccessClient } from '@/components/paywall/payment-success-client';
import { Skeleton } from '@/components/ui/skeleton';
import { messages } from '@novelhub/shared';

export default function PaymentSuccessPage(): JSX.Element {
  return (
    <Suspense fallback={<PaymentSuccessFallback />}>
      <PaymentSuccessClient />
    </Suspense>
  );
}

function PaymentSuccessFallback(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile flex-col items-center justify-center px-6 text-center">
      <div aria-label={messages.payment.confirming} className="w-full max-w-56 space-y-4">
        <Skeleton className="mx-auto h-7 w-40" />
        <Skeleton className="mx-auto h-4 w-52" />
      </div>
    </main>
  );
}
