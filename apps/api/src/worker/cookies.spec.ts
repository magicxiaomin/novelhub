import { Hono } from 'hono';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '../modules/auth/auth.constants';
import { setAuthCookies } from './cookies';

const buildSetCookieHeaders = async (domain?: string): Promise<string[]> => {
  const app = new Hono();
  app.post('/auth/login', (c) => {
    setAuthCookies(
      c,
      { accessToken: 'access-token', refreshToken: 'refresh-token' },
      { crossSite: false, domain, isProd: true },
    );
    return c.json({ ok: true });
  });

  const res = await app.request('/auth/login', { method: 'POST' });
  return splitSetCookieHeader(res.headers.get('set-cookie'));
};

const splitSetCookieHeader = (header: string | null): string[] => {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,]+=)/).map((part) => part.trim());
};

describe('Worker auth cookie helpers', () => {
  it('emits the configured shared auth cookie domain', async () => {
    const cookies = await buildSetCookieHeaders('.dramavela.com');

    expect(cookies).toHaveLength(2);
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${COOKIE_ACCESS}=access-token`),
        expect.stringContaining(`${COOKIE_REFRESH}=refresh-token`),
      ]),
    );
    for (const cookie of cookies) {
      expect(cookie).toContain('Domain=.dramavela.com');
    }
  });

  it('omits Domain by default for host-only auth cookies', async () => {
    const cookies = await buildSetCookieHeaders();

    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).not.toContain('Domain=');
    }
  });
});
