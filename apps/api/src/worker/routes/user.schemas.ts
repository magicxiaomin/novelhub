/**
 * Zod schemas for the Hono user-scoped routes (`/coins`, `/unlocks`,
 * `/reading-progress`, `/checkin`) — mirror the class-validator constraints
 * in the matching DTOs so validation parity holds between the Nest stack on
 * `:4000` and the Worker on `:8787`.
 *
 * Pagination fields use `z.coerce.number()` to mimic class-transformer's
 * `@Type(() => Number)` URL-string coercion. The shared `uuidParam` is in
 * catalog.schemas.ts.
 */
import { z } from 'zod';

const pageField = z.coerce.number().int().min(1).optional();
const limitField = z.coerce.number().int().min(1).max(100).optional();

export const listTransactionsQuerySchema = z.object({
  page: pageField,
  limit: limitField,
});

export const listUnlocksQuerySchema = z.object({
  page: pageField,
  limit: limitField,
  bookId: z.string().uuid().optional(),
});

export const listProgressQuerySchema = z.object({
  bookId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
});

export const saveProgressBodySchema = z.object({
  chapterId: z.string().uuid(),
  scrollPercent: z.coerce.number().min(0).max(100),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ListUnlocksQuery = z.infer<typeof listUnlocksQuerySchema>;
export type ListProgressQuery = z.infer<typeof listProgressQuerySchema>;
export type SaveProgressBody = z.infer<typeof saveProgressBodySchema>;
