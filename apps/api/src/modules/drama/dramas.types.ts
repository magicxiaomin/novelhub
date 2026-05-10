export type DramaSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  posterUrl: string;
  category: string;
  tags: string[];
  totalEpisodes: number;
  status: string;
  isFeatured: boolean;
  sortOrder: number;
  freeEpisodeCount: number;
  coinPerEpisode: number;
  publishedAt: string | null;
};

export type EpisodeProgress = {
  positionSeconds: number;
  durationSeconds: number | null;
  completedAt: string | null;
  lastWatchedAt: string;
};

export type EpisodeSummary = {
  id: string;
  episodeNumber: number;
  title: string;
  synopsis: string | null;
  durationSeconds: number | null;
  isFree: boolean;
  publishedAt: string | null;
  isUnlocked: boolean;
  progress: EpisodeProgress | null;
};

export type DramaDetail = DramaSummary & {
  episodes: EpisodeSummary[];
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  items: T[];
  pageInfo: PageInfo;
};

export type ListDramasQuery = {
  category?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
};
