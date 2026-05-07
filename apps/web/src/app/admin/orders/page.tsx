'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { PageTitle } from '@/components/admin/page-title';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminOrder } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

const columns: ColumnDef<AdminOrder>[] = [
  { accessorKey: 'userEmail', header: messages.admin.orders.columns.email },
  { accessorKey: 'stripeSessionId', header: messages.admin.orders.columns.session },
  { accessorKey: 'type', header: messages.admin.orders.columns.type },
  { accessorKey: 'amount', header: messages.admin.orders.columns.amount },
  { accessorKey: 'status', header: messages.admin.orders.columns.status },
  { accessorKey: 'createdAt', header: messages.admin.orders.columns.created },
];

export default function AdminOrdersPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data } = useQuery({
    queryKey: ['admin', 'orders', search, status],
    queryFn: () => adminApi.orders({ search: search || undefined, status: status || undefined }),
  });
  return (
    <section>
      <PageTitle title={messages.admin.orders.title} />
      <div className="mb-4 flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={messages.admin.orders.search}
        />
        <Input
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder={messages.admin.orders.status}
        />
      </div>
      <DataTable columns={columns} data={data?.items ?? []} />
    </section>
  );
}
