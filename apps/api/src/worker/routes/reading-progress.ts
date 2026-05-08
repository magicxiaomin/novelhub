/**
 * Hono `/reading-progress` routes — mirror
 * apps/api/src/modules/reading-progress/reading-progress.controller.ts.
 *
 * `POST /` returns 200 (matches Nest's `@HttpCode(HttpStatus.OK)`). `GET /`
 * is overloaded by the Nest controller: with `bookId` or `chapterId` it
 * returns a single match (or `null`); without, it returns the 10 most
 * recent Continue Reading entries. We preserve that behaviour here so the
 * frontend's single fetch keeps working unchanged.
 *
 * Throttling (`@Throttle({default: {limit: 30, ttl: 60_000}})` on POST) is
 * deferred to a later Cloudflare Rate Limiting binding task — Workers KV /
 * Durable Objects can host the same semantics, but it's out of scope here.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeReadingProgressService } from '../services/user-factory';
import { listProgressQuerySchema, saveProgressBodySchema } from './user.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & AuthVariables;

export const readingProgressRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', requireAuth)
  .post('/', zValidator('json', saveProgressBodySchema, validationHook), async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const progress = makeReadingProgressService(c.get('prisma'));
    return c.json(await progress.save(user.id, body), 200);
  })
  .get('/', zValidator('query', listProgressQuerySchema, validationHook), async (c) => {
    const user = c.get('user');
    const query = c.req.valid('query');
    const progress = makeReadingProgressService(c.get('prisma'));
    if (query.bookId || query.chapterId) {
      return c.json(await progress.findOne(user.id, query), 200);
    }
    return c.json(await progress.listRecent(user.id, 10), 200);
  });
