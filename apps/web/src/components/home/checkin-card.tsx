'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { claimCheckin, fetchCheckinStatus, queryKeys } from '@/lib/queries';
import { cn } from '@/lib/utils';
import messages from '@/../messages/en.json';

const dismissKey = (date: string): string => `checkin-card-dismissed-${date}`;

export function CheckinCard(): JSX.Element | null {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const status = useQuery({
    queryKey: queryKeys.checkinStatus,
    queryFn: fetchCheckinStatus,
    enabled: Boolean(user),
    retry: false,
  });

  useEffect(() => {
    if (!status.data?.today) return;
    setDismissed(sessionStorage.getItem(dismissKey(status.data.today)) === 'true');
  }, [status.data?.today]);

  const mutation = useMutation({
    mutationFn: claimCheckin,
    onSuccess: async (claim) => {
      const today = status.data?.today;
      if (today) sessionStorage.setItem(dismissKey(today), 'true');
      setDismissed(true);
      toast.success(messages.checkin.success.replace('{coins}', claim.coinsAwarded.toString()));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.checkinStatus }),
      ]);
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(messages.checkin.alreadyClaimed);
        await queryClient.invalidateQueries({ queryKey: queryKeys.checkinStatus });
        return;
      }
      toast.error(messages.checkin.error);
    },
  });

  const filledDots = useMemo(() => {
    if (!status.data) return 0;
    const current = status.data.streakCount % 7;
    return current === 0 && status.data.streakCount > 0 ? 7 : current;
  }, [status.data]);

  if (!user || dismissed) return null;

  if (status.isLoading) {
    return (
      <section className="px-4 pb-3">
        <Skeleton className="h-28 rounded-lg" />
      </section>
    );
  }

  if (!status.data) return null;

  const body = status.data.claimedToday
    ? messages.checkin.claimedBody.replace('{coins}', status.data.nextReward.toString())
    : messages.checkin.claimBody.replace('{coins}', status.data.todayReward.toString());
  const claimCta = messages.checkin.claimCta.replace('{coins}', status.data.todayReward.toString());

  return (
    <section className="px-4 pb-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{messages.checkin.title}</h2>
          <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, index) => {
              const day = index + 1;
              const filled = day <= filledDots;
              return (
                <span
                  key={day}
                  className={cn(
                    'block rounded-full transition-colors',
                    day === 7 ? 'h-3 w-3 ring-2 ring-primary/30' : 'h-2.5 w-2.5',
                    filled ? 'bg-primary' : 'bg-muted',
                  )}
                />
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>

        <Button
          type="button"
          className="shrink-0"
          disabled={status.data.claimedToday || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {status.data.claimedToday ? messages.checkin.claimedCta : claimCta}
        </Button>
      </div>
    </section>
  );
}
