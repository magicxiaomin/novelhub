import { describe, expect, it } from 'vitest';

import { getProductMode, isNovelsOnlyProductMode } from './productMode';

describe('productMode', () => {
  it('treats PRODUCT_MODE=novels as novels-only mode', () => {
    expect(getProductMode('novels')).toBe('novels');
    expect(isNovelsOnlyProductMode('novels')).toBe(true);
  });

  it('treats PRODUCT_MODE=mixed as mixed mode', () => {
    expect(getProductMode('mixed')).toBe('mixed');
    expect(isNovelsOnlyProductMode('mixed')).toBe(false);
  });

  it('preserves mixed mode when PRODUCT_MODE is unset', () => {
    expect(getProductMode(undefined)).toBe('mixed');
    expect(isNovelsOnlyProductMode(undefined)).toBe(false);
  });
});
