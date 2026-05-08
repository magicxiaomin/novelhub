/**
 * Hono cookie helpers — mirrors `apps/api/src/modules/auth/cookies.ts` so the
 * cookie names, attributes, and TTLs are identical between the Nest stack
 * (port 4000) and the Worker (port 8787). Frontend cookies persist verbatim
 * across the cutover.
 */
import { setCookie } from 'hono/cookie';
import type { Context } from 'hono';

import {
  ACCESS_TOKEN_MAX_AGE_MS,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from '../modules/auth/auth.constants';

export function setAuthCookies(
  c: Context,
  tokens: { accessToken: string; refreshToken: string },
  isProd: boolean,
): void {
  const baseOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax' as const,
    path: '/',
  };
  setCookie(c, COOKIE_ACCESS, tokens.accessToken, {
    ...baseOpts,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS / 1000,
  });
  setCookie(c, COOKIE_REFRESH, tokens.refreshToken, {
    ...baseOpts,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS / 1000,
  });
}

export function clearAuthCookies(c: Context, isProd: boolean): void {
  const baseOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: 0,
  };
  setCookie(c, COOKIE_ACCESS, '', baseOpts);
  setCookie(c, COOKIE_REFRESH, '', baseOpts);
}
