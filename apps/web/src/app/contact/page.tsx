import { revalidatePath } from 'next/cache';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import messages from '@/../messages/en.json';

async function submitContact(formData: FormData): Promise<void> {
  'use server';
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  await fetch(`${apiBase}/support/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      subject: String(formData.get('subject') ?? ''),
      body: String(formData.get('body') ?? ''),
    }),
  });
  revalidatePath('/contact');
}

export default function ContactPage(): JSX.Element {
  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.contactTitle}</h1>
      <p>{messages.legal.todo}</p>
      <p>{messages.legal.lastUpdated}</p>
      <form action={submitContact} className="not-prose mt-6 space-y-4">
        <Input name="name" required maxLength={100} placeholder={messages.contact.name} />
        <Input name="email" required type="email" placeholder={messages.contact.email} />
        <Input name="subject" required maxLength={200} placeholder={messages.contact.subject} />
        <textarea
          name="body"
          required
          maxLength={5000}
          placeholder={messages.contact.body}
          className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit">{messages.contact.submit}</Button>
      </form>
    </article>
  );
}
