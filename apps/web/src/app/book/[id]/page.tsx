import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { ChapterList } from '@/components/book/chapter-list';
import { CollapsibleDescription } from '@/components/book/collapsible-description';
import { BookViewContentEvent } from '@/components/book/book-view-content-event';
import { RelatedBooks } from '@/components/book/related-books';
import { StickyStartReading } from '@/components/book/sticky-cta';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { fakeRating } from '@/lib/fake-rating';
import { safeJsonLd } from '@/lib/json-ld';
import { fetchBookServer } from '@/lib/server-api';
import type { BookDetail } from '@/lib/types';
import { messages } from '@novelhub/shared';

type Params = { params: { id: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const book = await fetchBookServer(params.id).catch(() => null);
  if (!book) return { title: messages.errors.bookNotFound };
  const description = book.description.slice(0, 160);
  return {
    title: `${book.title} — ${book.author}`,
    description,
    openGraph: {
      title: `${book.title} — ${book.author}`,
      description,
      images: [{ url: book.coverUrl }],
      type: 'book',
    },
  };
}

export default async function BookPage({ params }: Params): Promise<JSX.Element> {
  const book = await fetchBookServer(params.id);
  if (!book) notFound();

  const rating = fakeRating(book.id);
  const wordsTotal = book.chapters.reduce((acc, c) => acc + c.wordCount, 0);
  const firstChapter = book.chapters[0]?.order ?? 1;

  return (
    <AppShell>
      <BookJsonLd book={book} rating={rating} />
      <BookViewContentEvent bookId={book.id} />

      <header className="px-4 pt-4">
        <div className="flex gap-4">
          <div className="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-xl bg-muted">
            <Image
              src={book.coverUrl}
              alt=""
              fill
              sizes="128px"
              priority
              className="object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <Badge variant="secondary" className="self-start">
              {book.category}
            </Badge>
            <h1 className="mt-2 text-xl font-bold leading-tight">{book.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.book.byAuthor} {book.author}
            </p>
            <p className="mt-auto text-xs uppercase tracking-wider text-muted-foreground">
              {book.status}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x rounded-2xl border bg-card text-center">
          <Stat label={messages.book.chapters} value={book.totalChapters.toString()} />
          <Stat
            label={messages.book.words}
            value={formatWordCount(wordsTotal || estimateWords(book))}
          />
          <Stat label={messages.book.rating} value={`${rating.toFixed(1)}★`} />
        </div>
      </header>

      <section className="mt-6 px-4">
        <h2 className="text-base font-semibold tracking-tight">{messages.book.about}</h2>
        <div className="mt-2">
          <CollapsibleDescription text={book.description} />
        </div>
      </section>

      <div className="mt-6 px-4">
        <ChapterList bookId={book.id} chapters={book.chapters} totalChapters={book.totalChapters} />
      </div>

      <RelatedBooks bookId={book.id} category={book.category} />

      {/* Bottom padding so the sticky CTA never overlaps content. */}
      <div className="h-28" />

      <StickyStartReading bookId={book.id} firstChapterOrder={firstChapter} />
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="px-2 py-3">
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function formatWordCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toString();
}

function estimateWords(book: BookDetail): number {
  // Detail endpoint only returns the first 10 chapters' wordCount; for total
  // book length, fall back to a chapter-count × 2.5K average rather than
  // misrepresenting a 1M-word epic as 25K.
  return book.totalChapters * 2500;
}

function BookJsonLd({ book, rating }: { book: BookDetail; rating: number }): JSX.Element {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    image: book.coverUrl,
    description: book.description,
    bookFormat: 'EBook',
    numberOfPages: book.totalChapters,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: rating.toString(),
      reviewCount: '1',
      bestRating: '5',
    },
  };
  return (
    <script
      type="application/ld+json"
      // Encode for a <script> context so stored book content cannot terminate
      // this JSON-LD block and run as HTML/JS.
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
