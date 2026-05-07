'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminApi, type AdminBook } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

type BookDraft = Omit<AdminBook, 'id' | 'coverImageKey'> & { coverImageKey?: string | null };

const emptyBook: BookDraft = {
  title: '',
  author: '',
  coverUrl: '',
  description: '',
  category: '',
  tags: [],
  status: 'ONGOING',
  freeChapterCount: 3,
  coinPerChapter: 5,
};

export function BookForm({ book }: { book?: AdminBook }): JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState<BookDraft>(book ?? emptyBook);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof BookDraft, value: string | number | string[] | null): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (): Promise<void> => {
    setSaving(true);
    const body = { ...draft, tags: draft.tags.filter(Boolean) };
    if (book) {
      await adminApi.updateBook(book.id, body);
    } else {
      const created = await adminApi.createBook(body);
      router.push(`/admin/books/${encodeURIComponent(created.id)}`);
      return;
    }
    setSaving(false);
    router.refresh();
  };

  const uploadCover = async (file: File | undefined): Promise<void> => {
    if (!file || !book) return;
    const { uploadUrl, key } = await adminApi.coverUploadUrl(file.type);
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    await adminApi.updateBook(book.id, { coverImageKey: key });
    update('coverImageKey', key);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="grid max-w-2xl gap-4"
    >
      <Input
        value={draft.title}
        onChange={(e) => update('title', e.target.value)}
        placeholder={messages.admin.fields.title}
        required
      />
      <Input
        value={draft.author}
        onChange={(e) => update('author', e.target.value)}
        placeholder={messages.admin.fields.author}
        required
      />
      <Input
        value={draft.coverUrl}
        onChange={(e) => update('coverUrl', e.target.value)}
        placeholder={messages.admin.fields.coverUrl}
        required
      />
      <Input
        value={draft.category}
        onChange={(e) => update('category', e.target.value)}
        placeholder={messages.admin.fields.category}
        required
      />
      <Input
        value={draft.status}
        onChange={(e) => update('status', e.target.value)}
        placeholder={messages.admin.fields.status}
        required
      />
      <Input
        value={draft.tags.join(', ')}
        onChange={(e) =>
          update(
            'tags',
            e.target.value.split(',').map((tag) => tag.trim()),
          )
        }
        placeholder={messages.admin.fields.tags}
      />
      <Input
        type="number"
        value={draft.freeChapterCount}
        onChange={(e) => update('freeChapterCount', Number(e.target.value))}
        placeholder={messages.admin.fields.freeChapterCount}
      />
      <Input
        type="number"
        value={draft.coinPerChapter}
        onChange={(e) => update('coinPerChapter', Number(e.target.value))}
        placeholder={messages.admin.fields.coinPerChapter}
      />
      <textarea
        value={draft.description}
        onChange={(e) => update('description', e.target.value)}
        placeholder={messages.admin.fields.description}
        className="min-h-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
        required
      />
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
