'use client';

import mammoth from 'mammoth';
import { useState } from 'react';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseChaptersFromText, type ParsedChapter } from '@/lib/admin/bulk-import';
import { adminApi } from '@/lib/admin/api';
import messages from '@/../messages/en.json';

const DEFAULT_REGEX = '^Chapter\\s+\\d+';
const CHUNK_SIZE = 50;

export default function ImportChaptersPage(): JSX.Element {
  const [bookId, setBookId] = useState('');
  const [regex, setRegex] = useState(DEFAULT_REGEX);
  const [chapters, setChapters] = useState<ParsedChapter[]>([]);

  const parseFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const text = file.name.endsWith('.docx')
      ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
      : await file.text();
    setChapters(parseChaptersFromText(text, regex));
  };

  const submit = async (): Promise<void> => {
    for (let i = 0; i < chapters.length; i += CHUNK_SIZE) {
      await adminApi.bulkChapters(bookId, chapters.slice(i, i + CHUNK_SIZE));
    }
  };

  return (
    <section>
      <PageTitle title={messages.admin.chapters.import} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="grid max-w-2xl gap-4"
      >
        <Input
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          placeholder={messages.admin.chapters.bookId}
          required
        />
        <Input
          value={regex}
          onChange={(e) => setRegex(e.target.value)}
          placeholder={messages.admin.chapters.regex}
          required
        />
        <Input
          type="file"
          accept=".txt,.docx"
          onChange={(e) => void parseFile(e.target.files?.[0])}
        />
        <p className="text-sm text-muted-foreground">
          {messages.admin.chapters.parsed.replaceAll('{count}', () => String(chapters.length))}
        </p>
        <Button type="submit" disabled={!bookId || chapters.length === 0}>
          {messages.admin.actions.create}
        </Button>
      </form>
    </section>
  );
}
