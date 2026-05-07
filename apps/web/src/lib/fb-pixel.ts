import { FB_CONSENT_ACCEPTED, FB_CONSENT_COOKIE, FB_CONSENT_DECLINED } from '@novelhub/shared';

export const FB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

type Fbq = {
  (command: 'init', pixelId: string): void;
  (
    command: 'track',
    eventName: string,
    customData?: Record<string, unknown>,
    options?: { eventID: string },
  ): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: Fbq;
};

type TrackResult = string | null;

const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
let initialized = false;

export function hasTrackingConsent(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${FB_CONSENT_COOKIE}=${FB_CONSENT_ACCEPTED}`);
}

export function setTrackingConsent(value: typeof FB_CONSENT_ACCEPTED | typeof FB_CONSENT_DECLINED) {
  document.cookie = `${FB_CONSENT_COOKIE}=${value}; path=/; max-age=${FB_COOKIE_MAX_AGE}; SameSite=Lax${secureCookieAttribute()}`;
}

export function readTrackingConsent(): string | null {
  if (typeof document === 'undefined') return null;
  const escapedName = escapeRegExp(FB_CONSENT_COOKIE);
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

export function initPixel(): void {
  if (!pixelId || !hasTrackingConsent() || initialized || typeof window === 'undefined') return;
  installFbqStub();
  window.fbq?.('init', pixelId);
  initialized = true;
}

export function fbTrackPageView(): TrackResult {
  return track('PageView');
}

export function fbTrackViewContent(input: {
  contentId: string;
  contentType: string;
  value?: number;
}): TrackResult {
  return track('ViewContent', {
    content_ids: [input.contentId],
    content_type: input.contentType,
    value: input.value,
  });
}

export function fbTrackAddToCart(input: {
  value: number;
  currency: string;
  contentIds: string[];
}): TrackResult {
  return track('AddToCart', {
    value: input.value,
    currency: input.currency,
    content_ids: input.contentIds,
    content_type: 'product',
  });
}

export function fbTrackInitiateCheckout(input: {
  value: number;
  currency: string;
  eventId?: string;
}): TrackResult {
  return track('InitiateCheckout', { value: input.value, currency: input.currency }, input.eventId);
}

export function fbTrackPurchase(input: {
  eventName: 'Purchase' | 'Subscribe';
  eventId: string;
  value?: number;
  currency: string;
  contentIds: string[];
}): TrackResult {
  return track(
    input.eventName,
    {
      value: input.value,
      currency: input.currency,
      content_ids: input.contentIds,
      content_type: 'product',
    },
    input.eventId,
  );
}

export function fbTrackCompleteRegistration(input: {
  method: string;
  eventId?: string;
}): TrackResult {
  return track('CompleteRegistration', { method: input.method }, input.eventId);
}

function track(
  eventName: string,
  customData: Record<string, unknown> = {},
  fixedEventId?: string,
): TrackResult {
  if (!hasTrackingConsent() || !window.fbq) return null;
  const eventId = fixedEventId ?? crypto.randomUUID();
  window.fbq('track', eventName, compact(customData), { eventID: eventId });
  return eventId;
}

function compact(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function secureCookieAttribute(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function installFbqStub(): void {
  if (window.fbq) return;
  const fbq: Fbq = ((...args: unknown[]): void => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue?.push(args);
    }
  }) as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = fbq;
  window.fbq = fbq;
  window._fbq = fbq;
}
