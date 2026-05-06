import type { Response } from 'express';

import {
  ACCESS_TOKEN_MAX_AGE_MS,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.constants';

const isProd = (): boolean => process.env.NODE_ENV === 'production';

export const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void => {
  const baseOpts = {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax' as const,
    path: '/',
  };
  res.cookie(COOKIE_ACCESS, tokens.accessToken, {
    ...baseOpts,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(COOKIE_REFRESH, tokens.refreshToken, {
    ...baseOpts,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

export const clearAuthCookies = (res: Response): void => {
  const baseOpts = {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax' as const,
    path: '/',
  };
  res.clearCookie(COOKIE_ACCESS, baseOpts);
  res.clearCookie(COOKIE_REFRESH, baseOpts);
};
