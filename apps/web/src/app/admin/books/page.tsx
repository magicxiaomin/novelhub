'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminApi, type AdminBook } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

export default function AdminBooksPage(): JSX.Element {
  const [deleteTarget, setDeleteTarget] = useState<AdminBook | null>(null);
  const { data, refetch } = useQuery({ queryKey: ['admin', 'books'], queryFn: adminApi.books });
  const columns: ColumnDef<AdminBook>[] = [
    { accessorKey: 'title', header: messages.admin.fields.title },
    { accessorKey: 'author', header: messages.admin.fields.author },
    { accessorKey: 'category', header: messages.admin.fields.category },
    { accessorKey: 'status', header: messages.admin.fields.status },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/books/${encodeURIComponent(row.original.id)}`}>
              {messages.admin.actions.edit}
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDeleteTarget(row.original)}
          >
            {messages.admin.actions.delete}
          </Button>
        </div>
      ),
    },
  ];

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    await adminApi.deleteBook(deleteTarget.id);
    setDeleteTarget(null);
    await refetch();
  };

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle title={messages.admin.books.title} />
        <Button asChild>
          <Link href="/admin/books/new">{messages.admin.books.new}</Link>
        </Button>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} />
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.admin.books.delete.title}</DialogTitle>
            <DialogDescription>{messages.admin.books.delete.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {messages.admin.actions.cancel}
            </Button>
            <Button type="button" onClick={() => void confirmDelete()}>
              {messages.admin.books.delete.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
