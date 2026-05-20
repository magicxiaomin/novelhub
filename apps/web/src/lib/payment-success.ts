import type { PaymentOrder } from './types';

export const PAYMENT_SUCCESS_TIMEOUT_MS = 60_000;
export const PAYMENT_SUCCESS_POLL_MS = 2_000;
export const READER_RETURN_URL_KEY = 'reader-return-url-v1';

export type PaymentSuccessState = 'missing-session' | 'confirming' | 'completed' | 'failed';

export function getPaymentSuccessState(
  order: PaymentOrder | null,
  startedAt: number,
  now: number,
): PaymentSuccessState {
  if (!order) {
    return now - startedAt >= PAYMENT_SUCCESS_TIMEOUT_MS ? 'failed' : 'confirming';
  }
  if (order.status === 'completed') return 'completed';
  if (order.status === 'failed' || order.status === 'refunded') return 'failed';
  return now - startedAt >= PAYMENT_SUCCESS_TIMEOUT_MS ? 'failed' : 'confirming';
}

export function getSafePaymentReturnUrl(value: string | null, origin: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? value : null;
  } catch {
    return null;
  }
}
