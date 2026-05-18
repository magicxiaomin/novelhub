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

const uuidV4Field = z
  .string()
  .uuid()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
    message: 'Invalid UUID v4',
  });
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

export const listProgressQuerySchema = z
  .object({
    bookId: uuidV4Field.optional(),
    chapterId: uuidV4Field.optional(),
  })
  .strict();

export const saveProgressBodySchema = z
  .object({
    chapterId: uuidV4Field,
    scrollPercent: z.coerce.number().min(0).max(100),
  })
  .strict();

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ListUnlocksQuery = z.infer<typeof listUnlocksQuerySchema>;
export type ListProgressQuery = z.infer<typeof listProgressQuerySchema>;
export type SaveProgressBody = z.infer<typeof saveProgressBodySchema>;
