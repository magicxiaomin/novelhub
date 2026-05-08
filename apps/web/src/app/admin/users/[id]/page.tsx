'use client';

export const runtime = 'edge';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

export default function AdminUserDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin', 'user', params.id],
    queryFn: () => adminApi.user(params.id),
  });
  const mutation = useMutation({
    mutationFn: () =>
      data?.bannedAt ? adminApi.unbanUser(params.id) : adminApi.banUser(params.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'user', params.id] });
    },
  });
  return (
    <section>
      <PageTitle title={messages.admin.users.detail} />
      {data ? (
        <div className="space-y-3">
          <p>{data.email}</p>
          <p>{data.coinBalance}</p>
          <p>{data.purchases?.count ?? 0}</p>
          <p>{data.purchases?.sumCents ?? 0}</p>
          <p>{data.unlocks?.count ?? 0}</p>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {data.bannedAt ? messages.admin.actions.unban : messages.admin.actions.ban}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
