'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { adminApi } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

export default function EditChapterPage({ params }: { params: { id: string } }): JSX.Element {
  const { data } = useQuery({
    queryKey: ['admin', 'chapter', params.id],
    queryFn: () => adminApi.chapter(params.id),
  });
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isFree, setIsFree] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setContent(data.content ?? '');
    setIsFree(data.isFree);
  }, [data]);

  const save = async (): Promise<void> => {
    await adminApi.updateChapter(params.id, { title, content, isFree });
    setSaved(true);
  };

  return (
    <section>
      <PageTitle title={messages.admin.chapters.edit} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="grid max-w-3xl gap-4"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={messages.admin.fields.title}
        />
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={isFree} onCheckedChange={setIsFree} />
          {messages.admin.fields.isFree}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-96 rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={messages.admin.fields.content}
        />
        <Button type="submit">
          {saved ? messages.admin.actions.confirm : messages.admin.actions.save}
        </Button>
      </form>
    </section>
  );
}
