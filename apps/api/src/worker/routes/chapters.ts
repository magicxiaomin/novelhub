/**
 * Hono `/chapters/:id` route — mirrors
 * apps/api/src/modules/chapters/chapters.controller.ts on `:8787`.
 *
 * Uses `optionalAuth` middleware so guests get the locked envelope while
 * signed-in users (with a subscription / unlock / free-chapter access) get
 * the unlocked envelope with a signed content URL. The Nest stack does the
 * same via `OptionalAuthGuard`.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { PrismaVariables } from '../db/prisma';
import { optionalAuth, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeChaptersService } from '../services/catalog-factory';
import { uuidParam } from './catalog.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & Partial<AuthVariables>;

const idParamSchema = z.object({ id: uuidParam });

export const chaptersRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>().get(
  '/:id',
  zValidator('param', idParamSchema, validationHook),
  optionalAuth,
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user') ?? null;
    const chapters = makeChaptersService(c.env, c.get('prisma'));
    const result = await chapters.readChapter(id, user?.id ?? null);
    return c.json(result, 200);
  },
);
