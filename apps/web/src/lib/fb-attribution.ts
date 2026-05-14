import { CONSENT_COOKIE, parseConsent } from '@novelhub/shared';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const FBCLID_RE = /^[A-Za-z0-9._-]{1,256}$/;
const UTM_RE = /^[A-Za-z0-9 ._~:/?#\x5B\x5D@!$&'()*+,;=%-]{1,256}$/;
export const FB_UTM_ATTRIBUTION_KEY = 'novelhub.fb_utm_attribution';
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

export function captureFbclid(): void {
  if (typeof window === 'undefined') return;
  if (parseConsent(readCookie(CONSENT_COOKIE))?.marketing !== true) return;

  const params = new URLSearchParams(window.location.search);
  captureFacebookUtm(params);
  const fbclid = params.get('fbclid');
  if (!fbclid || !FBCLID_RE.test(fbclid)) return;
  if (document.cookie.match(/(?:^|;\s*)_fbc=/)) return;

  const value = `fb.1.${Date.now()}.${fbclid}`;
  document.cookie = `_fbc=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureCookieAttribute()}`;
}

export function readFacebookUtmAttribution(): Record<string, string> | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem(FB_UTM_ATTRIBUTION_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && UTM_RE.test(entry[1]),
    );
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  } catch {
    return undefined;
  }
}

function captureFacebookUtm(params: URLSearchParams): void {
  const source = params.get('utm_source')?.toLowerCase();
  if (source !== 'facebook' && source !== 'fb' && !params.get('fbclid')) return;
  const attribution = Object.fromEntries(
    UTM_KEYS.map((key) => [key, params.get(`utm_${key}`)] as const).filter(
      (entry): entry is readonly [(typeof UTM_KEYS)[number], string] =>
        typeof entry[1] === 'string' && UTM_RE.test(entry[1]),
    ),
  );
  if (Object.keys(attribution).length === 0) return;
  window.sessionStorage.setItem(FB_UTM_ATTRIBUTION_KEY, JSON.stringify(attribution));
}

function secureCookieAttribute(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

function readCookie(name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  return match ? (match[1] ?? '') : null;
}
