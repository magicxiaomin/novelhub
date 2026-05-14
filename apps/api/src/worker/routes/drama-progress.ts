import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import type { SaveWatchProgressInput } from '../../modules/drama/dramas.types';
import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeDramasService } from '../services/dramas-factory';
import { dramaDeprecatedResponse, isDramaCutoffEnabled } from './drama-quarantine';
import { saveDramaProgressBodySchema } from './dramas.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & AuthVariables;

export const dramaProgressRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', async (c, next) => {
    if (isDramaCutoffEnabled(c.env)) return dramaDeprecatedResponse(c);
    return next();
  })
  .use('*', requireAuth)
  .post('/', zValidator('json', saveDramaProgressBodySchema, validationHook), async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const dramas = makeDramasService(c.env, c.get('prisma'));
    return c.json(await dramas.saveProgress(user.id, body as SaveWatchProgressInput), 200);
  })
  .get('/', async (c) => {
    const user = c.get('user');
    const dramas = makeDramasService(c.env, c.get('prisma'));
    return c.json(await dramas.listContinueWatching(user.id), 200);
  });
