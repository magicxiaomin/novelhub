import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { optionalAuth } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeDramasService } from '../services/dramas-factory';
import { dramaSlugParamSchema, listDramasQuerySchema } from './dramas.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & Partial<AuthVariables>;

export const dramasRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', optionalAuth)
  .get('/', zValidator('query', listDramasQuerySchema, validationHook), async (c) => {
    const query = c.req.valid('query');
    const dramas = makeDramasService(c.env, c.get('prisma'));
    return c.json(await dramas.list(query), 200);
  })
  .get('/:slug', zValidator('param', dramaSlugParamSchema, validationHook), async (c) => {
    const { slug } = c.req.valid('param');
    const user = c.get('user');
    const dramas = makeDramasService(c.env, c.get('prisma'));
    return c.json(await dramas.getBySlug(slug, user?.id ?? null), 200);
  });
