'use client';

export const runtime = 'edge';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { adminApi } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

const chapterFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(204800),
  isFree: z.boolean(),
  order: z.coerce.number().int().min(1),
});

type ChapterFormValues = z.infer<typeof chapterFormSchema>;

export default function EditChapterPage({ params }: { params: { id: string } }): JSX.Element {
  const { data } = useQuery({
    queryKey: ['admin', 'chapter', params.id],
    queryFn: () => adminApi.chapter(params.id),
  });
  const [saved, setSaved] = useState(false);
  const form = useForm<ChapterFormValues>({
    resolver: zodResolver(chapterFormSchema),
    defaultValues: { title: '', content: '', isFree: false, order: 1 },
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      title: data.title,
      content: data.content ?? '',
      isFree: data.isFree,
      order: data.order,
    });
  }, [data, form]);

  const save = async (values: ChapterFormValues): Promise<void> => {
    await adminApi.updateChapter(params.id, values);
    setSaved(true);
  };

  return (
    <section>
      <PageTitle title={messages.admin.chapters.edit} />
      <form
        onSubmit={form.handleSubmit((values) => void save(values))}
        className="grid max-w-3xl gap-4"
      >
        <Input {...form.register('title')} placeholder={messages.admin.fields.title} />
        <FieldError message={form.formState.errors.title?.message} />
        <Input
          type="number"
          {...form.register('order', { valueAsNumber: true })}
          placeholder={messages.admin.chapters.columns.order}
        />
        <FieldError message={form.formState.errors.order?.message} />
        <label className="flex items-center gap-3 text-sm">
          <Switch
            checked={form.watch('isFree')}
            onCheckedChange={(checked) => form.setValue('isFree', checked)}
          />
          {messages.admin.fields.isFree}
        </label>
        <textarea
          {...form.register('content')}
          className="min-h-96 rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={messages.admin.fields.content}
        />
        <FieldError message={form.formState.errors.content?.message} />
        <Button type="submit">
          {saved ? messages.admin.actions.confirm : messages.admin.actions.save}
        </Button>
      </form>
    </section>
  );
}

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  return message ? <p className="-mt-3 text-xs text-red-600">{message}</p> : null;
}
