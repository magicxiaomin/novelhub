'use client';

import useEmblaCarousel from 'embla-carousel-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import type { BookSummary } from '@/lib/types';

export function FeaturedCarousel({ books }: { books: BookSummary[] }): JSX.Element {
  const [emblaRef, embla] = useEmblaCarousel({ loop: books.length > 1, align: 'start' });
  const [active, setActive] = useState(0);

  const onSelect = useCallback(() => {
    if (!embla) return;
    setActive(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on('select', onSelect);
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla, onSelect]);

  if (books.length === 0) return <div />;

  return (
    <section className="px-4">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {books.map((book) => (
            <Link
              href={`/book/${book.id}`}
              key={book.id}
              className="relative mr-3 aspect-[16/9] w-full shrink-0 overflow-hidden rounded-2xl bg-muted last:mr-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={book.coverUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-xs uppercase tracking-widest text-white/85">{book.category}</p>
                <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-tight">
                  {book.title}
                </h2>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {books.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {books.map((book, idx) => (
            <span
              key={book.id}
              aria-hidden
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === active ? 'w-5 bg-brand' : 'w-1.5 bg-muted-foreground/40',
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
