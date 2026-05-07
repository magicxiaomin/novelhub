'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import messages from '@/../messages/en.json';

const contactFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage(): JSX.Element {
  const [sent, setSent] = useState(false);
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: '', email: '', subject: '', body: '' },
  });

  const submit = async (values: ContactFormValues): Promise<void> => {
    await apiFetch('/support/contact', { method: 'POST', body: values });
    setSent(true);
    form.reset();
  };

  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.contactTitle}</h1>
      <p>{messages.legal.todo}</p>
      <p>{messages.legal.lastUpdated}</p>
      <form
        onSubmit={form.handleSubmit((values) => void submit(values))}
        className="not-prose mt-6 space-y-4"
      >
        <Field>
          <Input {...form.register('name')} placeholder={messages.contact.name} />
          <FieldError message={form.formState.errors.name?.message} />
        </Field>
        <Field>
          <Input {...form.register('email')} type="email" placeholder={messages.contact.email} />
          <FieldError message={form.formState.errors.email?.message} />
        </Field>
        <Field>
          <Input {...form.register('subject')} placeholder={messages.contact.subject} />
          <FieldError message={form.formState.errors.subject?.message} />
        </Field>
        <Field>
          <textarea
            {...form.register('body')}
            placeholder={messages.contact.body}
            className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <FieldError message={form.formState.errors.body?.message} />
        </Field>
        {sent ? <p className="text-sm text-emerald-600">{messages.contact.sent}</p> : null}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {messages.contact.submit}
        </Button>
      </form>
    </article>
  );
}

function Field({ children }: { children: ReactNode }): JSX.Element {
  return <div className="grid gap-1">{children}</div>;
}

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  return message ? <p className="text-xs text-red-600">{message}</p> : null;
}
