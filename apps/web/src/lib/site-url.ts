const fallbackAppUrl = 'http://localhost:3000';

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

export function appBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl) return fallbackAppUrl;

  try {
    const url = new URL(configuredUrl);
    return trimTrailingSlashes(url.origin);
  } catch {
    return fallbackAppUrl;
  }
}

export function absoluteAppUrl(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${appBaseUrl()}/`)
    .toString()
    .replace(/\/$/, normalizedPath === '/' ? '/' : '');
}
