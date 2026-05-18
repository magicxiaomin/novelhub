import Link from 'next/link';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import type { BookSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md';

const sizeClasses: Record<Size, { wrapper: string; cover: string; title: string }> = {
  sm: { wrapper: 'w-28', cover: 'aspect-[3/4] w-28', title: 'text-sm' },
  md: { wrapper: 'w-36', cover: 'aspect-[3/4] w-36', title: 'text-sm' },
};

export function BookCard({
  book,
  size = 'md',
  showCategory = true,
}: {
  book: BookSummary;
  size?: Size;
  showCategory?: boolean;
}): JSX.Element {
  const cls = sizeClasses[size];
  return (
    <Link
      href={`/book/${book.id}`}
      className={cn('flex shrink-0 flex-col gap-2', cls.wrapper)}
      aria-label={book.title}
    >
      <div className={cn('relative overflow-hidden rounded-xl bg-muted', cls.cover)}>
        <Image
          src={book.coverUrl}
          alt=""
          width={size === 'sm' ? 112 : 144}
          height={size === 'sm' ? 149 : 192}
          sizes={size === 'sm' ? '112px' : '144px'}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {showCategory ? (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 bg-black/55 text-white backdrop-blur"
          >
            {book.category}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className={cn('line-clamp-2 font-medium leading-tight', cls.title)}>{book.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
      </div>
    </Link>
  );
}
