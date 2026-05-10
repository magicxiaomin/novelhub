import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import type { DramaSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';

export function DramaCard({
  drama,
  priority = false,
}: {
  drama: DramaSummary;
  priority?: boolean;
}): JSX.Element {
  return (
    <Link
      href={`/drama/${drama.slug}`}
      className="group block min-w-0"
      aria-label={`${messages.drama.watchNow}: ${drama.title}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-muted shadow-sm">
        <Image
          src={drama.posterUrl}
          alt=""
          fill
          sizes="(max-width: 480px) 45vw, 200px"
          priority={priority}
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
          <p className="line-clamp-2 text-sm font-semibold leading-tight">{drama.title}</p>
          <p className="mt-1 text-xs text-white/80">
            {drama.totalEpisodes} {messages.drama.episodes}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant="secondary" className="max-w-full truncate text-[10px]">
          {drama.category}
        </Badge>
        <span className="truncate text-xs text-muted-foreground">
          {drama.freeEpisodeCount} {messages.drama.free}
        </span>
      </div>
    </Link>
  );
}
