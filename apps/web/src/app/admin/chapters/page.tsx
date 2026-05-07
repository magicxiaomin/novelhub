'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminChapter } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

export default function AdminChaptersPage(): JSX.Element {
  const searchParams = useSearchParams();
  const bookId = searchParams.get('bookId') ?? undefined;
  const { data, refetch } = useQuery({
    queryKey: ['admin', 'chapters', bookId],
    queryFn: () => adminApi.chapters(bookId),
  });

  const reorder = async (chapter: AdminChapter, nextOrder: number): Promise<void> => {
    if (nextOrder < 1) return;
    if (nextOrder === chapter.order) return;
    await adminApi.updateChapter(chapter.id, { order: nextOrder });
    await refetch();
  };

  const columns: ColumnDef<AdminChapter>[] = [
    { accessorKey: 'bookTitle', header: messages.admin.books.title },
    {
      accessorKey: 'order',
      header: messages.admin.chapters.columns.order,
      cell: ({ row }) => (
        <Input
          type="number"
          min={1}
          defaultValue={row.original.order}
          aria-label={messages.admin.chapters.columns.order}
          className="w-24"
          onBlur={(event) => void reorder(row.original, Number(event.target.value))}
        />
      ),
    },
    { accessorKey: 'title', header: messages.admin.chapters.columns.title },
    { accessorKey: 'isFree', header: messages.admin.chapters.columns.free },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/chapters/${encodeURIComponent(row.original.id)}`}>
            {messages.admin.actions.edit}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle title={messages.admin.chapters.title} />
        <Button asChild>
          <Link href="/admin/chapters/import">{messages.admin.chapters.import}</Link>
        </Button>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} />
    </section>
  );
}
