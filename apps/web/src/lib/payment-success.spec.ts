import { describe, expect, it } from 'vitest';

import { PAYMENT_SUCCESS_TIMEOUT_MS, getPaymentSuccessState } from './payment-success';
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
  it('confirms while no terminal order is available', () => {
    expect(getPaymentSuccessState(null, 1_000, 2_000)).toBe('confirming');
    expect(getPaymentSuccessState(order('pending'), 1_000, 2_000)).toBe('confirming');
  });

  it('finishes on completed orders', () => {
    expect(getPaymentSuccessState(order('completed'), 1_000, 2_000)).toBe('completed');
  });

  it('fails on failed/refunded orders or timeout', () => {
    expect(getPaymentSuccessState(order('failed'), 1_000, 2_000)).toBe('failed');
    expect(getPaymentSuccessState(order('refunded'), 1_000, 2_000)).toBe('failed');
    expect(getPaymentSuccessState(null, 1_000, 1_000 + PAYMENT_SUCCESS_TIMEOUT_MS)).toBe('failed');
  });
});
