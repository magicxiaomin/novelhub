export const CONSENT_COOKIE = 'consent';
export const CONSENT_COOKIE_DAYS = 365;

export type ConsentCategories = {
  analytics: boolean;
  marketing: boolean;
};

export type ConsentValue = ConsentCategories | null;

export const DEFAULT_CONSENT: ConsentCategories = {
  analytics: false,
  marketing: false,
};

export function parseConsent(raw: string | null | undefined): ConsentValue {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean'
    ) {
      return { analytics: parsed.analytics, marketing: parsed.marketing };
    }
  } catch {
    // fall through
  }
  return null;
}

export function serializeConsent(value: ConsentCategories): string {
  return encodeURIComponent(JSON.stringify(value));
}
