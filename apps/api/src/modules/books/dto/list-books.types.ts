/**
 * Plain type aliases for the books query DTOs. The class-decorated versions
 * in `list-books.dto.ts` carry runtime metadata (class-validator,
 * class-transformer, swagger) for the Nest controller pipeline. Service
 * code imports the types from this file so the Cloudflare Worker can
 * type-check `BooksService` without pulling decorator parsing into its
 * tsconfig.
 */
export type ListBooksDto = {
  category?: string;
  status?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
};

export type SearchBooksDto = {
  q?: string;
  page?: number;
  limit?: number;
};

export type ListChaptersDto = {
  page?: number;
  limit?: number;
};
