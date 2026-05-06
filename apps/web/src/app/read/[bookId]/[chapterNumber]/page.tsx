import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReaderContent } from '@/components/reader/reader-content';
import { fetchBookChaptersServer, fetchChapterServer } from '@/lib/server-api';
import type { ChapterResponse, ChapterSummary, Paginated } from '@/lib/types';
import messages from '@/../messages/en.json';

type ReaderPageProps = {
  params: {
    bookId: string;
    chapterNumber: string;
  };
};

export async function generateMetadata({ params }: ReaderPageProps): Promise<Metadata> {
  const resolved = await resolveReaderChapter(params.bookId, params.chapterNumber);
  if (!resolved) return {};
  return {
    title: resolved.chapter.title,
    description: messages.reader.chapterDescription.replaceAll(
      '{title}',
      () => resolved.chapter.title,
    ),
  };
}

export default async function ReaderPage({ params }: ReaderPageProps): Promise<JSX.Element> {
  const resolved = await resolveReaderChapter(params.bookId, params.chapterNumber);
  if (!resolved) notFound();

  return (
    <ReaderContent
      chapter={resolved.chapter}
      initialChapters={resolved.chapters}
      currentUrl={`/read/${params.bookId}/${resolved.chapterNumber}`}
    />
  );
}

async function resolveReaderChapter(
  bookId: string,
  chapterNumberParam: string,
): Promise<{
  chapterNumber: number;
  chapters: Paginated<ChapterSummary>;
  chapter: ChapterResponse;
} | null> {
  const chapterNumber = Number(chapterNumberParam);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) return null;

  const chapters = await fetchInitialChapters(bookId, chapterNumber);
  if (!chapters) return null;

  const summary = chapters.items.find((chapter) => chapter.order === chapterNumber);
  if (!summary) return null;

  const chapter = await fetchChapterServer(summary.id);
  if (!chapter) return null;

  return { chapterNumber, chapters, chapter };
}

async function fetchInitialChapters(
  bookId: string,
  chapterNumber: number,
): Promise<Paginated<ChapterSummary> | null> {
  const firstPage = await fetchBookChaptersServer(bookId, 1, 200);
  if (!firstPage) return null;
  if (firstPage.items.some((chapter) => chapter.order === chapterNumber)) return firstPage;

  const currentPageNumber = Math.ceil(chapterNumber / 200);
  if (currentPageNumber <= 1) return firstPage;

  const currentPage = await fetchBookChaptersServer(bookId, currentPageNumber, 200);
  if (!currentPage) return firstPage;
  const byId = new Map<string, ChapterSummary>();
  for (const chapter of [...firstPage.items, ...currentPage.items]) byId.set(chapter.id, chapter);
  return {
    ...firstPage,
    items: [...byId.values()].sort((a, b) => a.order - b.order),
  };
}
