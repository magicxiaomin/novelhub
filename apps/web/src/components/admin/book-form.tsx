'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminBook } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

const bookFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(120),
  // Backend CreateBookDto.coverUrl is required; empty values would render
  // broken images on public listings.
  coverUrl: z.string().trim().url(),
  description: z.string().trim().min(1).max(10000),
  category: z.string().trim().min(1).max(80),
  tags: z.string().max(500),
  status: z.string().trim().min(1).max(40),
  freeChapterCount: z.coerce.number().int().min(0),
  coinPerChapter: z.coerce.number().int().min(1),
});

type BookFormValues = z.infer<typeof bookFormSchema>;

const emptyBook: BookFormValues = {
  title: '',
  author: '',
  coverUrl: '',
  description: '',
  category: '',
  tags: '',
  status: 'ONGOING',
  freeChapterCount: 3,
  coinPerChapter: 5,
};

export function BookForm({ book }: { book?: AdminBook }): JSX.Element {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: book
      ? {
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          description: book.description,
          category: book.category,
          tags: book.tags.join(', '),
          status: book.status,
          freeChapterCount: book.freeChapterCount,
          coinPerChapter: book.coinPerChapter,
        }
      : emptyBook,
  });

  const submit = async (values: BookFormValues): Promise<void> => {
    setSaving(true);
    try {
      const body = {
        ...values,
        tags: values.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      if (book) {
        await adminApi.updateBook(book.id, body);
      } else {
        const created = await adminApi.createBook(body);
        router.push(`/admin/books/${encodeURIComponent(created.id)}`);
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File | undefined): Promise<void> => {
    if (!file || !book) return;
    const { uploadUrl, key } = await adminApi.coverUploadUrl(file.type);
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    await adminApi.updateBook(book.id, { coverImageKey: key });
  };

  return (
    <form
      onSubmit={form.handleSubmit((values) => void submit(values))}
      className="grid max-w-2xl gap-4"
    >
      <Input {...form.register('title')} placeholder={messages.admin.fields.title} />
      <FieldError message={form.formState.errors.title?.message} />
      <Input {...form.register('author')} placeholder={messages.admin.fields.author} />
      <FieldError message={form.formState.errors.author?.message} />
      <Input {...form.register('coverUrl')} placeholder={messages.admin.fields.coverUrl} />
      <FieldError message={form.formState.errors.coverUrl?.message} />
      <Input {...form.register('category')} placeholder={messages.admin.fields.category} />
      <FieldError message={form.formState.errors.category?.message} />
      <Input {...form.register('status')} placeholder={messages.admin.fields.status} />
      <FieldError message={form.formState.errors.status?.message} />
      <Input {...form.register('tags')} placeholder={messages.admin.fields.tags} />
      <FieldError message={form.formState.errors.tags?.message} />
      <Input
        type="number"
        {...form.register('freeChapterCount', { valueAsNumber: true })}
        placeholder={messages.admin.fields.freeChapterCount}
      />
      <FieldError message={form.formState.errors.freeChapterCount?.message} />
      <Input
        type="number"
        {...form.register('coinPerChapter', { valueAsNumber: true })}
        placeholder={messages.admin.fields.coinPerChapter}
      />
      <FieldError message={form.formState.errors.coinPerChapter?.message} />
      <textarea
        {...form.register('description')}
        placeholder={messages.admin.fields.description}
        className="min-h-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <FieldError message={form.formState.errors.description?.message} />
      {book ? (
        <label className="grid gap-2 text-sm">
          <span>{messages.admin.books.cover}</span>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => void uploadCover(e.target.files?.[0])}
          />
        </label>
      ) : null}
      <Button type="submit" disabled={saving}>
        {messages.admin.actions.save}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  return message ? <p className="-mt-3 text-xs text-red-600">{message}</p> : null;
}
