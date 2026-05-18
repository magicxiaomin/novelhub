import { afterEach, describe, expect, it, vi } from 'vitest';

import robots from './robots';

describe('robots', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows crawling and references the env-derived sitemap URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.test/base/');

    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: '/',
      },
      sitemap: 'https://preview.example.test/sitemap.xml',
    });
  });

  it('falls back to localhost when no app URL is configured', () => {
    expect(robots()).toMatchObject({
      sitemap: 'http://localhost:3000/sitemap.xml',
    });
  });
});
