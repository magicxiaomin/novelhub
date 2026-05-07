import { FB_CONSENT_ACCEPTED, FB_CONSENT_COOKIE } from '@novelhub/shared';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function captureFbclid(): void {
  if (typeof window === 'undefined') return;
  if (!document.cookie.split('; ').includes(`${FB_CONSENT_COOKIE}=${FB_CONSENT_ACCEPTED}`)) return;

  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get('fbclid');
  if (!fbclid) return;
  if (document.cookie.match(/(?:^|;\s*)_fbc=/)) return;

  const value = `fb.1.${Date.now()}.${fbclid}`;
  document.cookie = `_fbc=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureCookieAttribute()}`;
}

function secureCookieAttribute(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}
