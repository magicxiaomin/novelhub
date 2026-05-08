/**
 * Hono `/books` routes — mirror the surface of
 * apps/api/src/modules/books/books.controller.ts on `:8787`.
 *
 * Keep route order intentional: more-specific paths (`/featured`,
 * `/trending`, `/categories`, `/search`) MUST come before the
 * `/:id` catch-all, otherwise Hono matches the literal segment as a UUID
 * param and the static handlers are unreachable.
 *
 * UUID validation uses `zValidator('param', { id: uuidParam })` — invalid
 * shapes return 400 (matches Nest's `ParseUUIDPipe`).
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeBooksService } from '../services/catalog-factory';
import {
  listBooksQuerySchema,
  listChaptersQuerySchema,
  searchBooksQuerySchema,
  uuidParam,
} from './catalog.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & Partial<AuthVariables>;

const idParamSchema = z.object({ id: uuidParam });

export const booksRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .get('/', zValidator('query', listBooksQuerySchema, validationHook), async (c) => {
    const query = c.req.valid('query');
    const books = makeBooksService(c.env, c.get('prisma'));
    const result = await books.list(query);
    return c.json(result, 200);
  })
  .get('/featured', async (c) => {
    const books = makeBooksService(c.env, c.get('prisma'));
    const result = await books.featured();
    return c.json(result, 200);
  })
  .get('/trending', async (c) => {
    const books = makeBooksService(c.env, c.get('prisma'));
    const result = await books.trending();
    return c.json(result, 200);
  })
  .get('/categories', async (c) => {
    const books = makeBooksService(c.env, c.get('prisma'));
    const result = await books.categories();
    return c.json(result, 200);
  })
  .get('/search', zValidator('query', searchBooksQuerySchema, validationHook), async (c) => {
    const query = c.req.valid('query');
    const books = makeBooksService(c.env, c.get('prisma'));
    const result = await books.search(query);
    return c.json(result, 200);
  })
  .get('/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid('param');
    const books = makeBooksService(c.env, c.get('prisma'));
    const result = await books.getById(id);
    return c.json(result, 200);
  })
  .get(
    '/:id/chapters',
    zValidator('param', idParamSchema, validationHook),
    zValidator('query', listChaptersQuerySchema, validationHook),
    async (c) => {
      const { id } = c.req.valid('param');
      const query = c.req.valid('query');
      const books = makeBooksService(c.env, c.get('prisma'));
      const result = await books.listChapters(id, query);
      return c.json(result, 200);
    },
  );
