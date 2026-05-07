'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { captureFbclid } from '@/lib/fb-attribution';
import { fbTrackPageView, hasTrackingConsent, initPixel } from '@/lib/fb-pixel';

export function FbTracking(): JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = (): void => setEnabled(hasTrackingConsent());
    sync();
    window.addEventListener('tracking-consent-changed', sync);
    return () => window.removeEventListener('tracking-consent-changed', sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    initPixel();
    captureFbclid();
    fbTrackPageView();
  }, [enabled, pathname, searchParams]);

  if (!enabled || !process.env.NEXT_PUBLIC_FB_PIXEL_ID) return null;

  return (
    <Script
      id="fb-pixel"
      strategy="afterInteractive"
      src="https://connect.facebook.net/en_US/fbevents.js"
      onLoad={initPixel}
    />
  );
}
