'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  FB_CONSENT_ACCEPTED,
  FB_CONSENT_DECLINED,
  fbTrackPageView,
  initPixel,
  readTrackingConsent,
  setTrackingConsent,
} from '@/lib/fb-pixel';
import messages from '@/../messages/en.json';

export function ConsentBanner(): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readTrackingConsent() === null);
  }, []);

  const accept = (): void => {
    setTrackingConsent(FB_CONSENT_ACCEPTED);
    initPixel();
    fbTrackPageView();
    setVisible(false);
    window.dispatchEvent(new Event('tracking-consent-changed'));
  };

  const decline = (): void => {
    setTrackingConsent(FB_CONSENT_DECLINED);
    setVisible(false);
    window.dispatchEvent(new Event('tracking-consent-changed'));
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-3">
      <div className="mx-auto max-w-[480px] rounded-lg border bg-background p-4 shadow-lg">
        <p className="text-sm leading-6 text-foreground">{messages.consent.body}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={decline}>
            {messages.consent.decline}
          </Button>
          <Button
            type="button"
            onClick={accept}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {messages.consent.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
