/**
 * Zod schemas for the Hono /admin routes — mirror the class-validator
 * constraints in apps/api/src/modules/admin/dto/*.dto.ts.
 */
import { z } from 'zod';

const pageField = z.coerce.number().int().min(1).optional();
const limitField = z.coerce.number().int().min(1).max(100).optional();

// Book DTOs
const bookStatusEnum = z.enum(['ONGOING', 'COMPLETED']);

export const createBookBodySchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(120),
  coverUrl: z.string().max(500),
  coverImageKey: z.string().max(500).optional(),
  description: z.string().max(5000),
  category: z.string().max(80),
  tags: z.array(z.string()).optional(),
  status: bookStatusEnum.optional(),
  isFeatured: z.boolean().optional(),
  freeChapterCount: z.coerce.number().int().min(1).max(3).optional(),
  coinPerChapter: z.coerce.number().int().min(0).optional(),
});

export const updateBookBodySchema = createBookBodySchema.partial();

// Chapter DTOs
export const updateChapterBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isFree: z.boolean().optional(),
  order: z.coerce.number().int().min(1).optional(),
  content: z.string().max(204800).optional(),
});

const bulkChapterSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(204800),
  isFree: z.boolean().optional(),
});

export const bulkCreateChaptersBodySchema = z.object({
  chapters: z.array(bulkChapterSchema).max(500),
});

export const bulkImportOptionsQuerySchema = z.object({
  delimiter: z.string().optional(),
  // Form fields and query strings carry boolean as the literal "true" / "false".
  replace: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
});

// Query DTOs
export const adminSearchQuerySchema = z.object({
  page: pageField,
  limit: limitField,
  search: z.string().optional(),
});

export const adminChapterListQuerySchema = z.object({
  page: pageField,
  limit: limitField,
  bookId: z.string().uuid().optional(),
});

export const adminOrderListQuerySchema = z.object({
  page: pageField,
  limit: limitField,
  search: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
});

export const coverUploadUrlBodySchema = z.object({
  contentType: z.string().optional(),
});

export const uuidParam = z.string().uuid();
