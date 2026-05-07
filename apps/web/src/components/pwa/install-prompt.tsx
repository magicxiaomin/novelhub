'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { hasCookie, setDaysCookie } from '@/lib/cookies';
import { CHAPTERS_READ_COUNT_EVENT, getChaptersReadCount } from '@/lib/read-count';
import messages from '@/../messages/en.json';

const DISMISSED_COOKIE = 'pwa-install-dismissed-at';
const MIN_CHAPTERS_READ = 2;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function InstallPrompt(): JSX.Element | null {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [eligible, setEligible] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    const updateEligibility = (): void => {
      setEligible(getChaptersReadCount() >= MIN_CHAPTERS_READ && !hasCookie(DISMISSED_COOKIE));
    };
    updateEligibility();
    window.addEventListener(CHAPTERS_READ_COUNT_EVENT, updateEligibility);
    return () => window.removeEventListener(CHAPTERS_READ_COUNT_EVENT, updateEligibility);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event): void => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!eligible || installEvent || !isIosSafari()) return;
    setIosOpen(true);
  }, [eligible, installEvent]);

  if (!eligible) return null;

  const dismiss = (): void => {
    setDaysCookie(DISMISSED_COOKIE, new Date().toISOString(), 7);
    setEligible(false);
    setIosOpen(false);
  };

  const install = async (): Promise<void> => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    dismiss();
  };

  return (
    <>
      {installEvent ? (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-mobile rounded-lg border bg-background p-3 shadow-lg">
          <p className="text-sm font-semibold">{messages.pwa.installTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{messages.pwa.installBody}</p>
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={install}
            >
              {messages.pwa.installCta}
            </Button>
            <Button className="flex-1" variant="outline" onClick={dismiss}>
              {messages.pwa.dismiss}
            </Button>
          </div>
        </div>
      ) : null}
      <Dialog
        open={iosOpen}
        onOpenChange={(open) => {
          if (!open) dismiss();
          setIosOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.pwa.iosTitle}</DialogTitle>
            <DialogDescription>{messages.pwa.iosBody}</DialogDescription>
          </DialogHeader>
          <Image
            src="/pwa/ios-install.png"
            alt={messages.pwa.iosImageAlt}
            width={320}
            height={220}
            className="w-full rounded-md border object-cover"
          />
          <DialogFooter>
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={dismiss}>
              {messages.pwa.gotIt}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function isIosSafari(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isIos = /iPad|iPhone|iPod/.test(nav.userAgent);
  const isStandalone = Boolean(nav.standalone);
  const isSafari = /^((?!CriOS|FxiOS|EdgiOS).)*Safari/i.test(nav.userAgent);
  return isIos && isSafari && !isStandalone;
}
