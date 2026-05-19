import { afterEach, describe, expect, it, vi } from 'vitest';

import { hasCookie, setDaysCookie } from './cookies';

const stubCookieEnvironment = (protocol: 'http:' | 'https:' = 'http:') => {
  let cookie = '';

  vi.stubGlobal('document', {
    get cookie() {
      return cookie;
    },
    set cookie(nextCookie: string) {
      cookie = nextCookie;
    },
  });
  vi.stubGlobal('window', {
    location: { protocol },
  });

  return {
    get cookie() {
      return cookie;
    },
    set cookie(nextCookie: string) {
      cookie = nextCookie;
    },
  };
};

describe('setDaysCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes a days-based cookie with path and SameSite=Lax over http', () => {
    const cookies = stubCookieEnvironment('http:');

    setDaysCookie('readerConsent', 'accepted=true,source=drawer', 7);

    expect(cookies.cookie).toBe(
      'readerConsent=accepted=true,source=drawer; Max-Age=604800; Path=/; SameSite=Lax',
    );
  });

  it('adds Secure only when the current page is https', () => {
    const cookies = stubCookieEnvironment('https:');

    setDaysCookie('readerConsent', 'accepted', 2);

    expect(cookies.cookie).toBe(
      'readerConsent=accepted; Max-Age=172800; Path=/; SameSite=Lax; Secure',
    );
  });

  it.each(['bad;attribute', 'bad\rattribute', 'bad\nattribute'])(
    'rejects cookie delimiter value %j',
    (value) => {
      stubCookieEnvironment('https:');

      expect(() => setDaysCookie('readerConsent', value, 1)).toThrow(
        'setDaysCookie: value contains a cookie delimiter; pre-encode with encodeURIComponent',
      );
    },
  );
});

describe('hasCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('matches exact cookie names from a semicolon-delimited cookie header', () => {
    const cookies = stubCookieEnvironment();
    cookies.cookie = 'session_id=abc; readerConsent=true; readerConsentExtra=false';

    expect(hasCookie('readerConsent')).toBe(true);
    expect(hasCookie('reader')).toBe(false);
    expect(hasCookie('readerConsentExtra')).toBe(true);
  });
});
