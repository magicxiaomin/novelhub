export type DramaStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
export type DramaProvider = 'external_hls';

export type CreateDramaDto = {
  slug: string;
  title: string;
  description: string;
  posterUrl: string;
  category: string;
  tags?: string[];
  status?: DramaStatus;
  isFeatured?: boolean;
  sortOrder?: number;
  freeEpisodeCount?: number;
  coinPerEpisode?: number;
};

export type UpdateDramaDto = Partial<CreateDramaDto>;

export type UpsertEpisodeVideoDto = {
  provider: DramaProvider;
  playbackUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
};

export type CreateEpisodeDto = {
  dramaId: string;
  episodeNumber: number;
  title: string;
  synopsis?: string;
  durationSeconds?: number;
  isFree?: boolean;
  isPublished?: boolean;
  video?: UpsertEpisodeVideoDto;
};

export type UpdateEpisodeDto = Partial<Omit<CreateEpisodeDto, 'dramaId'>>;
