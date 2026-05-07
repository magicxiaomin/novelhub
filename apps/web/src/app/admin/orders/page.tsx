'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { PageTitle } from '@/components/admin/page-title';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminOrder } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

const columns: ColumnDef<AdminOrder>[] = [
  { accessorKey: 'userEmail', header: 'Email' },
  { accessorKey: 'stripeSessionId', header: 'Session' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'createdAt', header: 'Created' },
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
