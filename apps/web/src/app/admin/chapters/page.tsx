'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { adminApi, type AdminChapter } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

const columns: ColumnDef<AdminChapter>[] = [
  { accessorKey: 'bookTitle', header: messages.admin.books.title },
  { accessorKey: 'order', header: 'Order' },
  { accessorKey: 'title', header: messages.admin.fields.title },
  { accessorKey: 'isFree', header: messages.admin.fields.isFree },
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

export default function AdminChaptersPage(): JSX.Element {
  const searchParams = useSearchParams();
  const bookId = searchParams.get('bookId') ?? undefined;
  const { data } = useQuery({
    queryKey: ['admin', 'chapters', bookId],
    queryFn: () => adminApi.chapters(bookId),
  });
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
