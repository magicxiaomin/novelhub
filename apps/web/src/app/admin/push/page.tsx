'use client';

export const runtime = 'edge';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

const pushFormSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(500),
  url: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        try {
          return new URL(value).protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: messages.admin.validation.httpsUrl },
    ),
  segmentName: z.string().trim().min(1).max(50).default(messages.admin.push.segmentAll),
});

type PushFormValues = z.infer<typeof pushFormSchema>;

export default function AdminPushPage(): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<PushFormValues>({
    resolver: zodResolver(pushFormSchema),
    defaultValues: { title: '', body: '', url: '', segmentName: messages.admin.push.segmentAll },
  });

  const send = async (): Promise<void> => {
    const values = pushFormSchema.parse(form.getValues());
    await adminApi.push({
      title: values.title,
      body: values.body,
      url: values.url || undefined,
      segment: values.segmentName,
    });
    setConfirmOpen(false);
  };

  return (
    <section>
      <PageTitle title={messages.admin.push.title} />
      <form
        onSubmit={form.handleSubmit(() => {
          setConfirmOpen(true);
        })}
        className="grid max-w-2xl gap-4"
      >
        <Input {...form.register('title')} placeholder={messages.admin.fields.title} />
        <FieldError message={form.formState.errors.title?.message} />
        <Input {...form.register('body')} placeholder={messages.admin.push.body} />
        <FieldError message={form.formState.errors.body?.message} />
        <Input {...form.register('url')} placeholder={messages.admin.push.url} />
        <FieldError message={form.formState.errors.url?.message} />
        <select
          {...form.register('segmentName')}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value={messages.admin.push.segmentAll}>{messages.admin.push.segmentAll}</option>
        </select>
        <FieldError message={form.formState.errors.segmentName?.message} />
        <Button type="submit">{messages.admin.actions.send}</Button>
      </form>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.admin.push.confirmTitle}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => void send()}>
              {messages.admin.actions.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  return message ? <p className="-mt-3 text-xs text-red-600">{message}</p> : null;
}
