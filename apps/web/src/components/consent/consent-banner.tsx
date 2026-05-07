'use client';

import { useEffect, useState } from 'react';
import type { ConsentCategories } from '@novelhub/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { initPixel, readTrackingConsent, setTrackingConsent } from '@/lib/fb-pixel';
import messages from '@/../messages/en.json';

export function ConsentBanner(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [preferences, setPreferences] = useState<ConsentCategories>({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    setVisible(readTrackingConsent() === null);
  }, []);

  const accept = (): void => {
    save({ analytics: true, marketing: true });
  };

  const reject = (): void => {
    save({ analytics: false, marketing: false });
  };

  const save = (value: ConsentCategories): void => {
    setTrackingConsent(value);
    if (value.marketing) {
      initPixel();
    } else {
      clearTrackingCookies();
    }
    setCustomizeOpen(false);
    setVisible(false);
    window.dispatchEvent(new Event('tracking-consent-changed'));
  };

  const openCustomize = (): void => {
    setPreferences(readTrackingConsent() ?? { analytics: false, marketing: false });
    setCustomizeOpen(true);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-3">
      <div className="mx-auto max-w-[480px] rounded-lg border bg-background p-4 shadow-lg">
        <p className="text-sm leading-6 text-foreground">{messages.consent.body}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Button type="button" variant="outline" onClick={reject}>
            {messages.consent.reject}
          </Button>
          <Button type="button" variant="outline" onClick={openCustomize}>
            {messages.consent.customize}
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
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.consent.customizeTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ConsentToggle label={messages.consent.necessary} checked disabled />
            <ConsentToggle
              label={messages.consent.analytics}
              checked={preferences.analytics}
              onCheckedChange={(analytics) =>
                setPreferences((current) => ({ ...current, analytics }))
              }
            />
            <ConsentToggle
              label={messages.consent.marketing}
              checked={preferences.marketing}
              onCheckedChange={(marketing) =>
                setPreferences((current) => ({ ...current, marketing }))
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => save(preferences)}>
              {messages.consent.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsentToggle({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function clearTrackingCookies(): void {
  document.cookie = `_fbc=; path=/; max-age=0; SameSite=Lax${secureCookieAttribute()}`;
  document.cookie = `_fbp=; path=/; max-age=0; SameSite=Lax${secureCookieAttribute()}`;
}

function secureCookieAttribute(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}
