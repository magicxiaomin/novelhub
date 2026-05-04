import { describe, expect, it } from 'vitest';

import { APP_NAME, SUBSCRIPTION_STATUSES } from './index';

describe('shared constants', () => {
  it('exposes the application name and supported subscription states', () => {
    expect(APP_NAME).toBe('NovelHub');
    expect(SUBSCRIPTION_STATUSES).toEqual(['active', 'past_due', 'canceled', 'expired']);
  });
});
