'use client';

export const runtime = 'edge';

import mammoth from 'mammoth';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { PageTitle } from '@/components/admin/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseChaptersFromText, type ParsedChapter } from '@/lib/admin/bulk-import';
import { adminApi } from '@/lib/admin/api';
import { messages } from '@novelhub/shared';

const DEFAULT_REGEX = '^Chapter\\s+\\d+';
// Each chapter is capped at 200KB (apps/api MAX_CHAPTER_CONTENT_BYTES). The
// backend bulk-import route accepts up to 10MB JSON; 25 chapters * 200KB =
// 5MB raw plus JSON escape overhead stays comfortably under the cap.
const CHUNK_SIZE = 25;

const importFormSchema = z.object({
  bookId: z.string().uuid(),
  regexSource: z.string().min(1).max(100),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

export default function ImportChaptersPage(): JSX.Element {
  const [chapters, setChapters] = useState<ParsedChapter[]>([]);
  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: { bookId: '', regexSource: DEFAULT_REGEX },
  });

  const parseFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const text = file.name.endsWith('.docx')
      ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
      : await file.text();
    setChapters(parseChaptersFromText(text, form.getValues('regexSource')));
  };

  const submit = async (values: ImportFormValues): Promise<void> => {
    let imported = 0;
    let failedChunkIndex: number | null = null;
    for (let i = 0; i < chapters.length; i += CHUNK_SIZE) {
      const chunk = chapters.slice(i, i + CHUNK_SIZE);
      try {
        await adminApi.bulkChapters(values.bookId, chunk);
        imported += chunk.length;
      } catch (err) {
        failedChunkIndex = i;
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(
          messages.admin.chapters.importPartial
            .replaceAll('{imported}', () => String(imported))
            .replaceAll('{total}', () => String(chapters.length))
            .replaceAll('{message}', () => message),
        );
        break;
      }
    }
    if (failedChunkIndex === null) {
      toast.success(messages.admin.chapters.imported.replaceAll('{count}', () => String(imported)));
    }
  };

  return (
    <section>
      <PageTitle title={messages.admin.chapters.import} />
      <form
        onSubmit={form.handleSubmit((values) => void submit(values))}
        className="grid max-w-2xl gap-4"
      >
        <Input {...form.register('bookId')} placeholder={messages.admin.chapters.bookId} />
        <FieldError message={form.formState.errors.bookId?.message} />
        <Input {...form.register('regexSource')} placeholder={messages.admin.chapters.regex} />
        <FieldError message={form.formState.errors.regexSource?.message} />
        <Input
          type="file"
          accept=".txt,.docx"
          onChange={(e) => void parseFile(e.target.files?.[0])}
        />
        <p className="text-sm text-muted-foreground">
          {messages.admin.chapters.parsed.replaceAll('{count}', () => String(chapters.length))}
        </p>
        <Button type="submit" disabled={chapters.length === 0}>
          {messages.admin.actions.create}
        </Button>
      </form>
    </section>
  );
}

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  return message ? <p className="-mt-3 text-xs text-red-600">{message}</p> : null;
}
