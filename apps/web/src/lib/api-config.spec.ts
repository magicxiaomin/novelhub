import { afterEach, describe, expect, it, vi } from 'vitest';

import { internalApiBaseUrl, publicApiBaseUrl } from './api-config';

const clearApiEnv = () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', undefined);
  vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
  vi.stubEnv('API_INTERNAL_URL', undefined);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('publicApiBaseUrl', () => {
  it('uses NEXT_PUBLIC_API_BASE_URL when set', () => {
    clearApiEnv();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://canonical.example.com');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://legacy.example.com');

    expect(publicApiBaseUrl()).toBe('https://canonical.example.com');
  });

  it('falls back to NEXT_PUBLIC_API_URL when canonical env is unset', () => {
    clearApiEnv();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://legacy.example.com');

    expect(publicApiBaseUrl()).toBe('https://legacy.example.com');
  });

  it('falls back to localhost when public env values are unset', () => {
    clearApiEnv();

    expect(publicApiBaseUrl()).toBe('http://localhost:4000');
  });
});

describe('internalApiBaseUrl', () => {
  it('uses API_INTERNAL_URL when set', () => {
    clearApiEnv();
    vi.stubEnv('API_INTERNAL_URL', 'https://internal.example.com');

    expect(internalApiBaseUrl()).toBe('https://internal.example.com');
  });

  it('falls back to localhost when API_INTERNAL_URL is unset', () => {
    clearApiEnv();

    expect(internalApiBaseUrl()).toBe('http://localhost:4000');
  });
});
