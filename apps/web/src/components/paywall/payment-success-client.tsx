'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { fetchPaymentOrder } from '@/lib/queries';
import {
  PAYMENT_SUCCESS_POLL_MS,
  READER_RETURN_URL_KEY,
  getPaymentSuccessState,
  type PaymentSuccessState,
} from '@/lib/payment-success';
import type { PaymentOrder } from '@/lib/types';
import messages from '@/../messages/en.json';

const SAFE_RETURN_URL = /^\/(?!\/)/;

export function PaymentSuccessClient(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const startedAt = useMemo(() => Date.now(), []);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [now, setNow] = useState(startedAt);
  const [retryKey, setRetryKey] = useState(0);
  const redirected = useRef(false);
  const state: PaymentSuccessState = sessionId
    ? getPaymentSuccessState(order, startedAt, now)
    : 'missing-session';

  useEffect(() => {
    if (!sessionId || state === 'completed' || state === 'failed') return;
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const nextOrder = await fetchPaymentOrder(sessionId);
        if (!cancelled) setOrder(nextOrder);
      } catch {
        if (!cancelled) setNow(Date.now());
      }
    };
    void poll();
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void poll();
    }, PAYMENT_SUCCESS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionId, state, retryKey]);

  useEffect(() => {
    if (state !== 'completed' || redirected.current) return;
    redirected.current = true;
    const returnUrl = window.sessionStorage.getItem(READER_RETURN_URL_KEY);
    const target = returnUrl && SAFE_RETURN_URL.test(returnUrl) ? returnUrl : '/';
    window.sessionStorage.removeItem(READER_RETURN_URL_KEY);
    const timeout = window.setTimeout(() => router.push(target), 600);
    return () => window.clearTimeout(timeout);
  }, [router, state]);

  const retry = (): void => {
    setOrder(null);
    setNow(Date.now());
    setRetryKey((value) => value + 1);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-mobile flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">{titleForState(state)}</h1>
      {state === 'failed' || state === 'missing-session' ? (
        <div className="mt-5 flex gap-3">
          {state === 'failed' ? (
            <Button
              type="button"
              onClick={retry}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {messages.payment.retry}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/">{messages.payment.home}</Link>
          </Button>
        </div>
      ) : null}
    </main>
  );
}

function titleForState(state: PaymentSuccessState): string {
  if (state === 'completed') return messages.payment.completed;
  if (state === 'failed') return messages.payment.failed;
  if (state === 'missing-session') return messages.payment.missingSession;
  return messages.payment.confirming;
}
