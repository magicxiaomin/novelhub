import { describe, expect, it } from 'vitest';

import { scrubSentryEvent } from './sentry-scrubber';

describe('scrubSentryEvent', () => {
  it('redacts top-level sensitive keys', () => {
    const event = {
      request: {
        email: 'user@example.com',
        password: 'secret',
        token: 'tok',
        authorization: 'Bearer x',
        cookie: 'jwt=y',
      },
    };
    const result = scrubSentryEvent(event);
    expect(result.request).toEqual({
      email: '[REDACTED]',
      password: '[REDACTED]',
      token: '[REDACTED]',
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
    });
  });

  it('recurses into nested objects', () => {
    const event = {
      extra: {
        user: { email: 'u@e.com', name: 'Alice' },
        request: { headers: { Authorization: 'Bearer x' } },
      },
    };
    const result = scrubSentryEvent(event);
    expect(result.extra).toEqual({
      user: { email: '[REDACTED]', name: 'Alice' },
      request: { headers: { Authorization: '[REDACTED]' } },
    });
  });

  it('preserves non-sensitive keys untouched', () => {
    const event = {
      request: { url: '/me', method: 'GET', userId: 'abc-123' },
    };
    const result = scrubSentryEvent(event);
    expect(result.request).toEqual({ url: '/me', method: 'GET', userId: 'abc-123' });
  });

  it('does not touch metadata fields (Stripe + FB CAPI)', () => {
    const event = {
      extra: {
        metadata: { orderId: 'ord_123', source: 'web' },
        chapterMeta: { wordCount: 1500 },
      },
    };
    const result = scrubSentryEvent(event);
    expect(result.extra).toEqual({
      metadata: { orderId: 'ord_123', source: 'web' },
      chapterMeta: { wordCount: 1500 },
    });
  });

  it('handles null, undefined, and primitive inputs without throwing', () => {
    expect(() => scrubSentryEvent({})).not.toThrow();
    expect(() => scrubSentryEvent({ request: null })).not.toThrow();
    expect(() => scrubSentryEvent({ extra: undefined })).not.toThrow();
    expect(() => scrubSentryEvent({ contexts: 42 as unknown as object })).not.toThrow();
  });

  it('terminates on circular references without stack overflow', () => {
    const a: Record<string, unknown> = { name: 'a', email: 'leak@ex.com' };
    const b: Record<string, unknown> = { name: 'b', other: a };
    a.cycle = b;
    const event = { extra: a };
    expect(() => scrubSentryEvent(event)).not.toThrow();
    expect(a.email).toBe('[REDACTED]');
  });
});
