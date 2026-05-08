/**
 * Hono `/unlocks` routes — mirror apps/api/src/modules/unlocks/unlocks.controller.ts
 * on `:8787`. Both routes require auth.
 *
 * `POST /unlocks/chapter/:chapterId` returns 201 on a fresh unlock and 201
 * (idempotent) for an existing unlock — same shape as the Nest controller's
 * `@HttpCode(HttpStatus.CREATED)`. On insufficient balance the service
 * throws `DomainError(402)` with the paywall context (`chapterId`,
 * `coinCost`, `currentBalance`); the Worker `app.onError` handler merges
 * those keys into the response body so the client sees the same envelope
 * it does on Nest.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeCoinsService, makeUnlocksService } from '../services/user-factory';
import { uuidParam } from './catalog.schemas';
import { listUnlocksQuerySchema } from './user.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & AuthVariables;

const chapterParamSchema = z.object({ chapterId: uuidParam });

export const unlocksRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', requireAuth)
  .post(
    '/chapter/:chapterId',
    zValidator('param', chapterParamSchema, validationHook),
    async (c) => {
      const user = c.get('user');
      const { chapterId } = c.req.valid('param');
      const prisma = c.get('prisma');
      const unlocks = makeUnlocksService(prisma, makeCoinsService(prisma));
      return c.json(await unlocks.unlockChapter(user.id, chapterId), 201);
    },
  )
  .get('/', zValidator('query', listUnlocksQuerySchema, validationHook), async (c) => {
    const user = c.get('user');
    const { page, limit, bookId } = c.req.valid('query');
    const prisma = c.get('prisma');
    const unlocks = makeUnlocksService(prisma, makeCoinsService(prisma));
    return c.json(await unlocks.list(user.id, page, limit, bookId), 200);
  });
