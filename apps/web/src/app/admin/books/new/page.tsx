import { BookForm } from '@/components/admin/book-form';
import { PageTitle } from '@/components/admin/page-title';
import { messages } from '@novelhub/shared';

export default function NewBookPage(): JSX.Element {
  return (
    <section>
      <PageTitle title={messages.admin.books.new} />
      <BookForm />
    </section>
  );
}
