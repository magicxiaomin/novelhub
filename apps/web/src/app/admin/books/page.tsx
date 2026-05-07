'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { adminApi, type AdminBook } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

const columns: ColumnDef<AdminBook>[] = [
  { accessorKey: 'title', header: messages.admin.fields.title },
  { accessorKey: 'author', header: messages.admin.fields.author },
  { accessorKey: 'category', header: messages.admin.fields.category },
  { accessorKey: 'status', header: messages.admin.fields.status },
  {
    id: 'actions',
    cell: ({ row }) => (
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/books/${encodeURIComponent(row.original.id)}`}>
          {messages.admin.actions.edit}
        </Link>
      </Button>
    ),
  },
];

export default function AdminBooksPage(): JSX.Element {
  const { data } = useQuery({ queryKey: ['admin', 'books'], queryFn: adminApi.books });
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle title={messages.admin.books.title} />
        <Button asChild>
          <Link href="/admin/books/new">{messages.admin.books.new}</Link>
        </Button>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} />
    </section>
  );
}
