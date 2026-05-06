import { describe, expect, it } from 'vitest';

import { safeJsonLd } from './json-ld';

describe('safeJsonLd', () => {
  it('escapes script-breaking HTML metacharacters', () => {
    expect(safeJsonLd({ title: '</script><script>alert(1)</script>&' })).toBe(
      '{"title":"\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e\\u0026"}',
    );
  });

  it('escapes line and paragraph separators for script context', () => {
    expect(safeJsonLd({ text: 'line\u2028paragraph\u2029' })).toBe(
      '{"text":"line\\u2028paragraph\\u2029"}',
    );
  });
});
