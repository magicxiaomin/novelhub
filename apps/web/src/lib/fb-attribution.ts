import { CONSENT_COOKIE, parseConsent } from '@novelhub/shared';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const FBCLID_RE = /^[A-Za-z0-9._-]{1,256}$/;

export function captureFbclid(): void {
  if (typeof window === 'undefined') return;
  if (parseConsent(readCookie(CONSENT_COOKIE))?.marketing !== true) return;

  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get('fbclid');
  if (!fbclid || !FBCLID_RE.test(fbclid)) return;
  if (document.cookie.match(/(?:^|;\s*)_fbc=/)) return;

  const value = `fb.1.${Date.now()}.${fbclid}`;
  document.cookie = `_fbc=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureCookieAttribute()}`;
}

function secureCookieAttribute(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

function readCookie(name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  return match ? (match[1] ?? '') : null;
}
