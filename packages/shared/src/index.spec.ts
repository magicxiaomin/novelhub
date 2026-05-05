import { describe, expect, it } from 'vitest';

import DEFAULT_APP_NAME, { APP_NAME, SUBSCRIPTION_STATUSES } from './index';

describe('shared constants', () => {
  it('exposes the application name as the default export for runtime package imports', () => {
    expect(DEFAULT_APP_NAME).toBe('NovelHub');
  });

  it('exposes the application name and supported subscription states', () => {
    expect(APP_NAME).toBe('NovelHub');
    expect(SUBSCRIPTION_STATUSES).toEqual(['active', 'past_due', 'canceled', 'expired']);
  });
});
