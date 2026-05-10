export const COOKIE_DOMAIN_ENV = 'AUTH_COOKIE_DOMAIN';

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

export const parseCsvOrigins = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export const corsAllowedOrigins = (env: {
  NEXT_PUBLIC_APP_URL?: string;
  CORS_EXTRA_ORIGINS?: string;
}): string[] => {
  const origins = [env.NEXT_PUBLIC_APP_URL, ...parseCsvOrigins(env.CORS_EXTRA_ORIGINS)].filter(
    (origin): origin is string => Boolean(origin),
  );
  return Array.from(new Set(origins));
};

/**
 * Cookie Domain is intentionally opt-in. Host-only cookies are safer for the
 * drama-first cutover because dramavela.com/www and novel.dramavela.com can
 * run separate variants without leaking auth between them. Operators may set
 * AUTH_COOKIE_DOMAIN=.dramavela.com only after deciding shared auth across all
 * subdomains is desired.
 */
export const authCookieDomain = (value: string | undefined): string | undefined => {
  const domain = value?.trim();
  if (!domain) return undefined;
  if (domain.includes('://') || domain.includes('/') || domain.includes(':')) return undefined;
  const normalized = domain.startsWith('.') ? domain.slice(1) : domain;
  if (!normalized.includes('.') || LOCALHOST_NAMES.has(normalized)) return undefined;
  return domain;
};
