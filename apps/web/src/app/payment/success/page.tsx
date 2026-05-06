import { Suspense } from 'react';

import { PaymentSuccessClient } from '@/components/paywall/payment-success-client';
import messages from '@/../messages/en.json';

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
      <h1 className="text-2xl font-bold">{messages.payment.confirming}</h1>
    </main>
  );
}
