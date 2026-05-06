export const PRISMA = Symbol('PRISMA');
export const GOOGLE_OAUTH_CLIENT = Symbol('GOOGLE_OAUTH_CLIENT');

export const COOKIE_ACCESS = 'jwt';
export const COOKIE_REFRESH = 'jwt_refresh';

export const ACCESS_TOKEN_TTL = '24h';
export const REFRESH_TOKEN_TTL = '30d';
export const RESET_TOKEN_TTL = '1h';

export const ACCESS_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const SIGNUP_BONUS_COINS = 20;
export const COIN_TXN_TYPE_SIGNUP = 'SIGNUP_BONUS';

export const SUBSCRIPTION_ACTIVE_STATUSES: readonly string[] = ['active', 'past_due', 'canceled'];

export type AuthUser = {
  id: string;
  email: string;
  coinBalance: number;
  hasPassword: boolean;
  hasActiveSubscription: boolean;
};

export type JwtPayload = {
  sub: string;
  email?: string;
  type: 'access' | 'refresh' | 'reset';
};
