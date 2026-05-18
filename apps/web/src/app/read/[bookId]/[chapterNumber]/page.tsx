export const runtime = 'edge';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReaderContent } from '@/components/reader/reader-content';
import { buildReaderChapterJsonLd, buildReaderChapterMetadata } from '@/lib/reader-metadata';
import { safeJsonLd } from '@/lib/json-ld';
import { fetchBookChaptersServer, fetchBookServer, fetchChapterServer } from '@/lib/server-api';
import type { BookDetail, ChapterResponse, ChapterSummary, Paginated } from '@/lib/types';

type ReaderPageProps = {
  params: {
    bookId: string;
    chapterNumber: string;
  };
};

export async function generateMetadata({ params }: ReaderPageProps): Promise<Metadata> {
  const resolved = await resolveReaderChapter(params.bookId, params.chapterNumber);
  if (!resolved) return {};
  return buildReaderChapterMetadata({
    book: resolved.book,
    chapter: resolved.chapter,
    canonicalPath: readerCanonicalPath(params.bookId, resolved.chapterNumber),
  });
}

export default async function ReaderPage({ params }: ReaderPageProps): Promise<JSX.Element> {
  const resolved = await resolveReaderChapter(params.bookId, params.chapterNumber);
  if (!resolved) notFound();

  return (
    <>
      <ReaderChapterJsonLd
        book={resolved.book}
        chapter={resolved.chapter}
        canonicalPath={readerCanonicalPath(params.bookId, resolved.chapterNumber)}
      />
      <ReaderContent
        chapter={resolved.chapter}
        initialChapters={resolved.chapters}
        currentUrl={readerCanonicalPath(params.bookId, resolved.chapterNumber)}
        bookTitle={resolved.book.title}
        bookCover={resolved.book.coverUrl}
      />
    </>
  );
}

function ReaderChapterJsonLd({
  book,
  chapter,
  canonicalPath,
}: {
  book: BookDetail;
  chapter: ChapterResponse;
  canonicalPath: string;
}): JSX.Element {
  const data = buildReaderChapterJsonLd({ book, chapter, canonicalPath });
  return (
    <script
      type="application/ld+json"
      // Encode for a <script> context so chapter metadata cannot terminate
      // this JSON-LD block and run as HTML/JS.
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

function readerCanonicalPath(bookId: string, chapterNumber: number): string {
  return `/read/${encodeURIComponent(bookId)}/${chapterNumber}`;
}

async function resolveReaderChapter(
  bookId: string,
  chapterNumberParam: string,
): Promise<{
  chapterNumber: number;
  book: BookDetail;
  chapters: Paginated<ChapterSummary>;
  chapter: ChapterResponse;
} | null> {
  const chapterNumber = Number(chapterNumberParam);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) return null;

  const [book, chapters] = await Promise.all([
    fetchBookServer(bookId),
    fetchInitialChapters(bookId, chapterNumber),
  ]);
  if (!book) return null;
  if (!chapters) return null;

  const summary = chapters.items.find((chapter) => chapter.order === chapterNumber);
  if (!summary) return null;

  const chapter = await fetchChapterServer(summary.id);
  if (!chapter) return null;

  return { chapterNumber, book, chapters, chapter };
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
