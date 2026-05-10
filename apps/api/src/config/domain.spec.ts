import { authCookieDomain, corsAllowedOrigins, parseCsvOrigins } from './domain';

describe('domain variant configuration', () => {
  it('parses CORS_EXTRA_ORIGINS as trimmed comma-separated origins', () => {
    expect(
      parseCsvOrigins(
        ' https://dramavela.com,https://www.dramavela.com, ,https://novel.dramavela.com ',
      ),
    ).toEqual([
      'https://dramavela.com',
      'https://www.dramavela.com',
      'https://novel.dramavela.com',
    ]);
  });

  it('builds a de-duplicated credentialed CORS allowlist for drama and novel variants', () => {
    expect(
      corsAllowedOrigins({
        NEXT_PUBLIC_APP_URL: 'https://dramavela.com',
        CORS_EXTRA_ORIGINS:
          'https://www.dramavela.com,https://novel.dramavela.com,https://dramavela.com',
      }),
    ).toEqual([
      'https://dramavela.com',
      'https://www.dramavela.com',
      'https://novel.dramavela.com',
    ]);
  });

  it('keeps auth cookie Domain host-only unless a valid parent domain is explicitly configured', () => {
    expect(authCookieDomain(undefined)).toBeUndefined();
    expect(authCookieDomain('localhost')).toBeUndefined();
    expect(authCookieDomain('https://dramavela.com')).toBeUndefined();
    expect(authCookieDomain('.dramavela.com')).toBe('.dramavela.com');
  });
});
