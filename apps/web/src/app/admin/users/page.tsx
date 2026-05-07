'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminUser } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

const columns: ColumnDef<AdminUser>[] = [
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'coinBalance', header: 'Coins' },
  { accessorKey: 'isAdmin', header: 'Admin' },
  { accessorKey: 'bannedAt', header: 'Banned' },
  {
    id: 'actions',
    cell: ({ row }) => (
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/users/${encodeURIComponent(row.original.id)}`}>
          {messages.admin.actions.edit}
        </Link>
      </Button>
    ),
  },
];

export default function AdminUsersPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminApi.users(search || undefined),
  });
  return (
    <section>
      <PageTitle title={messages.admin.users.title} />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={messages.admin.users.search}
        className="mb-4 max-w-sm"
      />
      <DataTable columns={columns} data={data?.items ?? []} />
    </section>
  );
}
