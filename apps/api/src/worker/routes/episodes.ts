import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { optionalAuth } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeDramasService } from '../services/dramas-factory';
import { episodeIdParamSchema } from './dramas.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & Partial<AuthVariables>;

export const episodesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', optionalAuth)
  .get(
    '/:episodeId/playback',
    zValidator('param', episodeIdParamSchema, validationHook),
    async (c) => {
      const { episodeId } = c.req.valid('param');
      const user = c.get('user');
      const dramas = makeDramasService(c.env, c.get('prisma'));
      return c.json(await dramas.getPlayback(episodeId, user?.id ?? null), 200);
    },
  );
