import { z } from 'zod';

const paginationInt = (defaultValue: number, max: number) =>
  z
    .preprocess(
      (value) => (value === undefined || value === '' ? undefined : Number(value)),
      z.number().int().min(1).max(max),
    )
    .optional()
    .default(defaultValue);

export const listDramasQuerySchema = z.object({
  page: paginationInt(1, 10_000),
  pageSize: paginationInt(20, 50),
  category: z.string().trim().min(1).max(80).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const dramaSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
