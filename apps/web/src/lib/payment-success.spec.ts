import { describe, expect, it } from 'vitest';

import {
  PAYMENT_SUCCESS_TIMEOUT_MS,
  getPaymentSuccessState,
  getSafePaymentReturnUrl,
} from './payment-success';
import type { PaymentOrder } from './types';

const order = (status: PaymentOrder['status']): PaymentOrder => ({
  status,
  type: 'COIN_PURCHASE',
  amount: 999,
  currency: 'usd',
  coinsGranted: 50,
  completedAt: status === 'completed' ? '2026-05-06T00:00:00.000Z' : null,
});

describe('payment success state machine', () => {
  it.each([
    { status: null, elapsedMs: PAYMENT_SUCCESS_TIMEOUT_MS - 1, expected: 'confirming' },
    {
      status: 'pending' as const,
      elapsedMs: PAYMENT_SUCCESS_TIMEOUT_MS - 1,
      expected: 'confirming',
    },
    { status: 'completed' as const, elapsedMs: 0, expected: 'completed' },
    { status: 'failed' as const, elapsedMs: 0, expected: 'failed' },
    { status: 'refunded' as const, elapsedMs: 0, expected: 'failed' },
    { status: null, elapsedMs: PAYMENT_SUCCESS_TIMEOUT_MS, expected: 'failed' },
    { status: 'pending' as const, elapsedMs: PAYMENT_SUCCESS_TIMEOUT_MS, expected: 'failed' },
  ])(
    'returns $expected for status $status after $elapsedMs ms',
    ({ status, elapsedMs, expected }) => {
      expect(getPaymentSuccessState(status ? order(status) : null, 1_000, 1_000 + elapsedMs)).toBe(
        expected,
      );
    },
  );
});

describe('payment return-url safety', () => {
  const origin = 'https://novelhub.test';

  it.each([
    ['/read/book-1/7', '/read/book-1/7'],
    ['/read/book-1/7?from=paywall#chapter', '/read/book-1/7?from=paywall#chapter'],
    ['https://novelhub.test/read/book-1/7', 'https://novelhub.test/read/book-1/7'],
    [null, null],
    ['', null],
    ['https://evil.example/phish', null],
    ['javascript:alert(1)', null],
    ['http://novelhub.test/read/book-1/7', null],
    ['http://[malformed', null],
  ])('maps %s to %s', (value, expected) => {
    expect(getSafePaymentReturnUrl(value, origin)).toBe(expected);
  });
});
