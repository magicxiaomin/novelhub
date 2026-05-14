import {
  CONSENT_COOKIE,
  CONSENT_COOKIE_DAYS,
  parseConsent,
  serializeConsent,
  type ConsentCategories,
} from '@novelhub/shared';

import { setDaysCookie } from './cookies';

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
  return parseConsent(readRawCookie(CONSENT_COOKIE))?.marketing === true;
}

export function setTrackingConsent(value: ConsentCategories): void {
  setDaysCookie(CONSENT_COOKIE, serializeConsent(value), CONSENT_COOKIE_DAYS);
}

export function readTrackingConsent(): ConsentCategories | null {
  if (typeof document === 'undefined') return null;
  return parseConsent(readRawCookie(CONSENT_COOKIE));
}

function readRawCookie(name: string): string | null {
  const escapedName = escapeRegExp(name);
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  return match ? (match[1] ?? '') : null;
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
  novelId?: string;
  chapterId?: string;
  utm?: Record<string, string>;
}): TrackResult {
  return track('ViewContent', {
    content_ids: [input.contentId],
    content_type: input.contentType,
    value: input.value,
    novel_id: input.novelId,
    chapter_id: input.chapterId,
    ...prefixedUtm(input.utm),
  });
}

export function fbTrackAddToCart(input: {
  value: number;
  currency: string;
  contentIds: string[];
  novelId?: string;
  chapterId?: string;
}): TrackResult {
  return track('AddToCart', {
    value: input.value,
    currency: input.currency,
    content_ids: input.contentIds,
    content_type: 'novel_chapter',
    novel_id: input.novelId,
    chapter_id: input.chapterId,
  });
}

export function fbTrackInitiateCheckout(input: {
  value: number;
  currency: string;
  eventId?: string;
  contentIds?: string[];
  novelId?: string;
  chapterId?: string;
}): TrackResult {
  return track(
    'InitiateCheckout',
    {
      value: input.value,
      currency: input.currency,
      content_ids: input.contentIds,
      content_type: input.contentIds ? 'novel_chapter' : undefined,
      novel_id: input.novelId,
      chapter_id: input.chapterId,
    },
    input.eventId,
  );
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

function prefixedUtm(utm: Record<string, string> | undefined): Record<string, string> {
  if (!utm) return {};
  return Object.fromEntries(Object.entries(utm).map(([key, value]) => [`utm_${key}`, value]));
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
