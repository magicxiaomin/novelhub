'use client';

import { useQuery } from '@tanstack/react-query';

import { BookForm } from '@/components/admin/book-form';
import { PageTitle } from '@/components/admin/page-title';
import { adminApi } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

export default function EditBookPage({ params }: { params: { id: string } }): JSX.Element {
  const { data } = useQuery({
    queryKey: ['admin', 'book', params.id],
    queryFn: () => adminApi.book(params.id),
  });
  return (
    <section>
      <PageTitle title={messages.admin.books.edit} />
      {data ? <BookForm book={data} /> : null}
    </section>
  );
}
