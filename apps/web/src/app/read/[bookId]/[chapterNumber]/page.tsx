import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReaderContent } from '@/components/reader/reader-content';
import { fetchBookChaptersServer, fetchChapterServer } from '@/lib/server-api';
import type { ChapterSummary, Paginated } from '@/lib/types';
import messages from '@/../messages/en.json';

type ReaderPageProps = {
  params: {
    bookId: string;
    chapterNumber: string;
  };
};

export const metadata: Metadata = {
  title: messages.reader.chapter,
};

export default async function ReaderPage({ params }: ReaderPageProps): Promise<JSX.Element> {
  const chapterNumber = Number(params.chapterNumber);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) notFound();

  const chapters = await fetchInitialChapters(params.bookId, chapterNumber);
  if (!chapters) notFound();

  const summary = chapters.items.find((chapter) => chapter.order === chapterNumber);
  if (!summary) notFound();

  const chapter = await fetchChapterServer(summary.id);
  if (!chapter) notFound();

  return (
    <ReaderContent
      chapter={chapter}
      initialChapters={chapters}
      currentUrl={`/read/${params.bookId}/${chapterNumber}`}
    />
  );
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
