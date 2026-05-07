'use client';

import { useState } from 'react';

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
import messages from '@/../messages/en.json';

export default function AdminPushPage(): JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [segment, setSegment] = useState('All');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const send = async (): Promise<void> => {
    await adminApi.push({ title, body, url: url || undefined, segment });
    setConfirmOpen(false);
  };

  return (
    <section>
      <PageTitle title={messages.admin.push.title} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setConfirmOpen(true);
        }}
        className="grid max-w-2xl gap-4"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={messages.admin.fields.title}
          required
        />
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={messages.admin.push.body}
          required
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={messages.admin.push.url}
        />
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="All">All</option>
        </select>
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
