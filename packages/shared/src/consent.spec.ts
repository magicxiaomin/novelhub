import { describe, expect, it } from 'vitest';

import { parseConsent, serializeConsent } from './consent';

describe('consent cookie helpers', () => {
  it('parses valid encoded JSON consent', () => {
    expect(parseConsent(serializeConsent({ analytics: true, marketing: false }))).toEqual({
      analytics: true,
      marketing: false,
    });
  });

  it('returns null for invalid and legacy inputs', () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent('accepted')).toBeNull();
    expect(parseConsent('%7B%22analytics%22%3Atrue%7D')).toBeNull();
    expect(parseConsent('%')).toBeNull();
  });
});
