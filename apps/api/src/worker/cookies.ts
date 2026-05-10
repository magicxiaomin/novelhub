/**
 * Hono cookie helpers — mirrors `apps/api/src/modules/auth/cookies.ts` so the
 * cookie names, attributes, and TTLs are identical between the Nest stack
 * (port 4000) and the Worker (port 8787). Frontend cookies persist verbatim
 * across the cutover.
 */
import { setCookie } from 'hono/cookie';
import type { Context } from 'hono';

import { authCookieDomain } from '../config/domain';
import {
  ACCESS_TOKEN_MAX_AGE_MS,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from '../modules/auth/auth.constants';

export type CookieMode = {
  /**
   * `true` when the API and the web app live on different registrable
   * domains (e.g. `*.workers.dev` API + `*.pages.dev` web on staging).
   * Triggers `SameSite=None` so cookies survive cross-site fetch+credentials,
   * and forces `Secure` (browsers reject `SameSite=None` without it).
   *
   * `false` for same-site setups (e.g. `api.novelhub.com` + `app.novelhub.com`
   * sharing `novelhub.com`) — keeps `SameSite=Lax`, which is safer and
   * defends against stray top-level CSRF.
   */
  crossSite: boolean;
  /** Production-mode flag. When false, `Secure` is omitted in same-site mode
   * so dev over `http://localhost` can still set cookies. */
  isProd: boolean;
  /** Optional AUTH_COOKIE_DOMAIN; validated before being written. */
  domain?: string;
};

function cookieOpts(mode: CookieMode): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'Lax' | 'None';
  path: '/';
  domain?: string;
} {
  return {
    httpOnly: true,
    // SameSite=None is invalid without Secure, so force it on for cross-site.
    secure: mode.crossSite || mode.isProd,
    sameSite: mode.crossSite ? 'None' : 'Lax',
    path: '/',
    domain: authCookieDomain((mode as CookieMode & { domain?: string }).domain),
  };
}

export function setAuthCookies(
  c: Context,
  tokens: { accessToken: string; refreshToken: string },
  mode: CookieMode,
): void {
  const baseOpts = cookieOpts(mode);
  setCookie(c, COOKIE_ACCESS, tokens.accessToken, {
    ...baseOpts,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS / 1000,
  });
  setCookie(c, COOKIE_REFRESH, tokens.refreshToken, {
    ...baseOpts,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS / 1000,
  });
}

export function clearAuthCookies(c: Context, mode: CookieMode): void {
  const baseOpts = { ...cookieOpts(mode), maxAge: 0 };
  setCookie(c, COOKIE_ACCESS, '', baseOpts);
  setCookie(c, COOKIE_REFRESH, '', baseOpts);
}
