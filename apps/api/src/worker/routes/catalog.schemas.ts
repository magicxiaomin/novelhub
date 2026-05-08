/**
 * Zod schemas for the Hono catalog routes — mirror the class-validator
 * constraints in `apps/api/src/modules/books/dto/list-books.dto.ts` so
 * validation parity holds between the Nest stack on `:4000` and the Worker
 * on `:8787`. These schemas are Worker-only; the Nest controllers continue
 * to consume the class-validator DTOs unchanged.
 *
 * Pagination fields use `z.coerce.number()` because URL query strings only
 * carry strings — class-transformer's `@Type(() => Number)` does the same
 * coercion in the Nest pipeline.
 */
import { z } from 'zod';

const pageField = z.coerce.number().int().min(1).optional();
const limitField = z.coerce.number().int().min(1).max(100).optional();
const chapterLimitField = z.coerce.number().int().min(1).max(200).optional();

// `featured` arrives as `?featured=true` or `?featured=false` — coerce to
// boolean to match @Transform in the Nest DTO. Anything else (incl. absent)
// → undefined (not filtered).
const featuredField = z
  .union([z.literal('true'), z.literal('false')])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const listBooksQuerySchema = z.object({
  category: z.string().min(1).max(64).optional(),
  status: z.enum(['ONGOING', 'COMPLETED']).optional(),
  featured: featuredField,
  page: pageField,
  limit: limitField,
});

export const searchBooksQuerySchema = z.object({
  q: z.string().max(200).optional(),
  page: pageField,
  limit: limitField,
});

export const listChaptersQuerySchema = z.object({
  page: pageField,
  limit: chapterLimitField,
});

export const uuidParam = z.string().uuid();

export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;
export type SearchBooksQuery = z.infer<typeof searchBooksQuerySchema>;
export type ListChaptersQuery = z.infer<typeof listChaptersQuerySchema>;
