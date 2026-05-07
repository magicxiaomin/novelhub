'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, Languages, Mail, Shield, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { DeleteAccountDialog } from '@/components/account/delete-account-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchPortal,
  fetchReadingProgress,
  fetchSubscription,
  logout,
  queryKeys,
} from '@/lib/queries';
import { formatAccountDate, formatSubscriptionPlanName, getInitials } from '@/lib/formatters';
import { messages } from '@novelhub/shared';

const fill = (template: string, values: Record<string, string>): string => {
  let result = template;
  for (const [token, value] of Object.entries(values)) {
    result = result.replaceAll(`{${token}}`, () => value);
  }
  return result;
};

export function MeClient(): JSX.Element {
  const router = useRouter();
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const { user, isLoading, openAuthModal, refetch } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (isLoading || user) return;
    openAuthModal({ mode: 'signin' });
  }, [isLoading, openAuthModal, user]);

  const subscription = useQuery({
    queryKey: queryKeys.subscription,
    queryFn: fetchSubscription,
    enabled: Boolean(user?.hasActiveSubscription),
  });
  const history = useQuery({
    queryKey: queryKeys.readingProgress,
    queryFn: fetchReadingProgress,
    enabled: Boolean(user),
  });
  const portal = useMutation({
    mutationFn: fetchPortal,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: () => toast.error(messages.account.portalError),
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await refetch();
      router.push('/');
    },
    onError: () => toast.error(messages.account.logoutError),
  });

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="space-y-4 px-5 py-6">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5 px-5 py-6">
        <header className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand text-xl font-bold text-brand-foreground">
            {getInitials(user.email)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{messages.account.title}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </header>

        <Card className="rounded-lg">
          <CardHeader>
            <p className="text-sm font-medium text-muted-foreground">{messages.account.coins}</p>
            <p className="text-3xl font-bold">{user.coinBalance}</p>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
              <Link href="/recharge">{messages.account.getMoreCoins}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <p className="text-sm font-semibold">{messages.account.subscription}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.hasActiveSubscription ? (
              subscription.isLoading ? (
                <Skeleton className="h-16 rounded-md" />
              ) : subscription.data ? (
                <>
                  <div>
                    <p className="font-semibold">
                      {formatSubscriptionPlanName(subscription.data.plan)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fill(
                        subscription.data.cancelAtPeriodEnd
                          ? messages.account.cancelsOn
                          : messages.account.renewsOn,
                        { date: formatAccountDate(subscription.data.currentPeriodEnd) },
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={portal.isPending}
                    onClick={() => portal.mutate()}
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {messages.account.manageSubscription}
                  </Button>
                </>
              ) : (
                <SubscribeLink />
              )
            ) : (
              <SubscribeLink />
            )}
          </CardContent>
        </Card>

        <section>
          <h2 className="text-lg font-semibold">{messages.account.readingHistory}</h2>
          <div className="mt-3 space-y-3">
            {history.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))
            ) : (history.data ?? []).length > 0 ? (
              (history.data ?? []).slice(0, 10).map((entry) => (
                <Link
                  key={`${entry.bookId}-${entry.chapterId}`}
                  href={`/read/${encodeURIComponent(entry.bookId)}/${entry.chapterNumber}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Image
                    src={entry.bookCover}
                    alt=""
                    width={48}
                    height={64}
                    className="h-16 w-12 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{entry.bookTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {fill(messages.account.historyProgress, {
                        chapterNumber: String(entry.chapterNumber),
                        scrollPercent: String(Math.round(entry.scrollPercent)),
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            ) : (
              <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                {messages.account.emptyHistory}
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{messages.account.settings}</h2>
          <div className="mt-3 overflow-hidden rounded-lg border bg-card">
            <SettingsButton
              icon={<Bell />}
              label={messages.account.notifications}
              onClick={() => toast(messages.account.comingSoon)}
            />
            <SettingsButton
              icon={<Languages />}
              label={messages.account.language}
              onClick={() => toast(messages.account.englishOnly)}
            />
            <SettingsLink href="/privacy" icon={<Shield />} label={messages.account.privacy} />
            <SettingsLink href="/terms" icon={<Shield />} label={messages.account.terms} />
            {supportEmail ? (
              <SettingsLink
                href={`mailto:${supportEmail}`}
                icon={<Mail />}
                label={messages.account.contact}
              />
            ) : null}
            <SettingsButton
              label={messages.account.logout}
              onClick={() => logoutMutation.mutate()}
            />
            <SettingsButton
              icon={<Trash2 />}
              label={messages.account.deleteAccount}
              onClick={() => setDeleteOpen(true)}
              danger
            />
          </div>
        </section>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </AppShell>
  );
}

function SubscribeLink(): JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{messages.account.subscribePrompt}</p>
      <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
        <Link href="/recharge?tab=subscribe">{messages.account.subscribeCta}</Link>
      </Button>
    </div>
  );
}

function SettingsButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon?: JSX.Element;
  label: string;
  onClick: () => void;
  danger?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center gap-3 border-b px-4 text-left text-sm last:border-b-0"
      onClick={onClick}
    >
      <span className={danger ? 'text-red-600' : 'text-muted-foreground'}>
        {icon ?? <ChevronRight className="h-4 w-4 opacity-0" />}
      </span>
      <span className={danger ? 'text-red-600' : undefined}>{label}</span>
    </button>
  );
}

function SettingsLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: JSX.Element;
  label: string;
}): JSX.Element {
  return (
    <Link
      className="flex h-12 items-center gap-3 border-b px-4 text-sm last:border-b-0"
      href={href}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
