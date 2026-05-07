'use client';

import Script from 'next/script';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PUSH_PERMISSION_REWARD_COINS } from '@novelhub/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/components/providers';
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
import { fetchReadingProgress, grantPushBonus, queryKeys } from '@/lib/queries';
import messages from '@/../messages/en.json';

const DISMISSED_COOKIE = 'push-permission-dismissed-at';
const MIN_CHAPTERS_READ = 3;

type OneSignalApi = {
  init: (options: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  User: {
    addTag: (key: string, value: string) => Promise<void>;
    addTags: (tags: Record<string, string>) => Promise<void>;
    PushSubscription: {
      optIn: () => Promise<void>;
      optedIn?: boolean;
      subscribed?: boolean;
      isOptedIn?: boolean;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalApi) => void | Promise<void>>;
  }
}

export function PushPrompt(): JSX.Element | null {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const [eligible, setEligible] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const grantMutation = useMutation({
    mutationFn: grantPushBonus,
    onSuccess: async (result) => {
      if (result.granted) {
        toast.success(
          messages.push.bonusSuccess.replaceAll('{coins}', () =>
            PUSH_PERMISSION_REWARD_COINS.toString(),
          ),
        );
        await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      }
    },
    onError: () => toast.error(messages.push.bonusError),
  });

  useEffect(() => {
    const updateEligibility = (): void => {
      setEligible(
        Boolean(user) &&
          Boolean(appId) &&
          getChaptersReadCount() >= MIN_CHAPTERS_READ &&
          !hasCookie(DISMISSED_COOKIE) &&
          canAskForNotifications(),
      );
    };
    updateEligibility();
    window.addEventListener(CHAPTERS_READ_COUNT_EVENT, updateEligibility);
    return () => window.removeEventListener(CHAPTERS_READ_COUNT_EVENT, updateEligibility);
  }, [appId, user]);

  useEffect(() => {
    if (!eligible || !scriptReady || !appId || initialized) return;
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true });
      if (!user) return;
      await tagUser(OneSignal, user.id, user.hasActiveSubscription);
      setInitialized(true);
      setOpen(true);
    });
  }, [appId, eligible, initialized, scriptReady, user]);

  if (!eligible || !appId) return null;

  const dismiss = (): void => {
    setDaysCookie(DISMISSED_COOKIE, new Date().toISOString(), 7);
    setOpen(false);
    setEligible(false);
  };

  const allow = (): void => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      await OneSignal.User.PushSubscription.optIn();
      // optIn resolves after both accepted and denied prompts, so verify the final state.
      const isSubscribed =
        OneSignal.User.PushSubscription.optedIn ??
        OneSignal.User.PushSubscription.subscribed ??
        OneSignal.User.PushSubscription.isOptedIn ??
        window.Notification.permission === 'granted';
      setOpen(false);
      if (!isSubscribed) {
        setDaysCookie(DISMISSED_COOKIE, '1', 7);
        setEligible(false);
        return;
      }
      grantMutation.mutate();
    });
  };

  return (
    <>
      <Script
        id="onesignal-sdk"
        strategy="afterInteractive"
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        onLoad={() => setScriptReady(true)}
      />
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) dismiss();
          setOpen(nextOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.push.title}</DialogTitle>
            <DialogDescription>{messages.push.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={dismiss}>
              {messages.push.deny}
            </Button>
            <Button
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={grantMutation.isPending}
              onClick={allow}
            >
              {messages.push.allow}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function tagUser(
  oneSignal: OneSignalApi,
  userId: string,
  hasActiveSubscription: boolean,
): Promise<void> {
  await oneSignal.login(userId);
  const progress = await fetchReadingProgress().catch(() => []);
  const lastBookId = progress[0]?.bookId;
  await oneSignal.User.addTag('user_id', userId);
  await oneSignal.User.addTag('subscription_status', hasActiveSubscription ? 'active' : 'inactive');
  if (lastBookId) await oneSignal.User.addTag('last_book_id', lastBookId);
}

function canAskForNotifications(): boolean {
  if (!('Notification' in window)) return false;
  return (
    window.Notification.permission !== 'denied' && window.Notification.permission !== 'granted'
  );
}
