/**
 * Plain type aliases for the admin book DTOs. The class-decorated versions
 * in `book.dto.ts` carry class-validator + swagger metadata for the Nest
 * controller pipeline. Service code imports the types from this file so
 * the Worker tsconfig (no experimentalDecorators) can type-check
 * AdminService without parsing decorators.
 */
export type CreateBookDto = {
  title: string;
  author: string;
  coverUrl: string;
  coverImageKey?: string;
  description: string;
  category: string;
  tags?: string[];
  status?: 'ONGOING' | 'COMPLETED';
  isFeatured?: boolean;
  freeChapterCount?: number;
  coinPerChapter?: number;
};

export type UpdateBookDto = Partial<CreateBookDto>;
