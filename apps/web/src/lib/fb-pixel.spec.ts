import { afterEach, describe, expect, it, vi } from 'vitest';

import { fbTrackAddToCart, fbTrackInitiateCheckout, fbTrackViewContent } from './fb-pixel';

type FbCall = [string, string, Record<string, unknown>, { eventID: string }];

const marketingConsent = encodeURIComponent(JSON.stringify({ analytics: false, marketing: true }));

function installTrackingGlobals(): FbCall[] {
  const calls: FbCall[] = [];
  vi.stubGlobal('document', { cookie: `consent=${marketingConsent}` });
  vi.stubGlobal('crypto', { randomUUID: () => 'event-id' });
  vi.stubGlobal('window', {
    fbq: (...args: FbCall) => {
      calls.push(args);
    },
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Facebook Pixel novel funnel payloads', () => {
  it('tracks ViewContent with Facebook UTM attribution and novel-only identifiers', () => {
    const calls = installTrackingGlobals();

    fbTrackViewContent({
      contentId: 'book-1',
      contentType: 'novel',
      novelId: 'book-1',
      utm: { source: 'facebook', campaign: 'novel-funnel', medium: 'paid-social' },
    });

    expect(calls[0]).toEqual([
      'track',
      'ViewContent',
      {
        content_ids: ['book-1'],
        content_type: 'novel',
        novel_id: 'book-1',
        utm_source: 'facebook',
        utm_campaign: 'novel-funnel',
        utm_medium: 'paid-social',
      },
      { eventID: 'event-id' },
    ]);
    expect(JSON.stringify(calls[0]?.[2])).not.toContain('drama_id');
    expect(JSON.stringify(calls[0]?.[2])).not.toContain('episode_id');
  });

  it('tracks paywall add-to-cart and checkout with novel_id/chapter_id', () => {
    const calls = installTrackingGlobals();

    fbTrackAddToCart({
      value: 12.99,
      currency: 'USD',
      contentIds: ['chapter-4'],
      novelId: 'book-1',
      chapterId: 'chapter-4',
    });
    fbTrackInitiateCheckout({
      value: 12.99,
      currency: 'USD',
      contentIds: ['chapter-4'],
      novelId: 'book-1',
      chapterId: 'chapter-4',
    });

    expect(calls.map((call) => call[2])).toEqual([
      {
        value: 12.99,
        currency: 'USD',
        content_ids: ['chapter-4'],
        content_type: 'novel_chapter',
        novel_id: 'book-1',
        chapter_id: 'chapter-4',
      },
      {
        value: 12.99,
        currency: 'USD',
        content_ids: ['chapter-4'],
        content_type: 'novel_chapter',
        novel_id: 'book-1',
        chapter_id: 'chapter-4',
      },
    ]);
  });
});
