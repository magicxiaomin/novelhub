/**
 * Hono `/coins` routes — mirror apps/api/src/modules/coins/coins.controller.ts
 * on `:8787`. All routes are gated by `requireAuth`; the JWT cookie carries
 * the user identity, no path-level user IDs.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeCoinsService } from '../services/user-factory';
import { listTransactionsQuerySchema } from './user.schemas';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & AuthVariables;

export const coinsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', requireAuth)
  .get('/balance', async (c) => {
    const user = c.get('user');
    const coins = makeCoinsService(c.get('prisma'));
    return c.json(await coins.getBalance(user.id), 200);
  })
  .get(
    '/transactions',
    zValidator('query', listTransactionsQuerySchema, validationHook),
    async (c) => {
      const user = c.get('user');
      const { page, limit } = c.req.valid('query');
      const coins = makeCoinsService(c.get('prisma'));
      return c.json(await coins.listTransactions(user.id, page, limit), 200);
    },
  );
