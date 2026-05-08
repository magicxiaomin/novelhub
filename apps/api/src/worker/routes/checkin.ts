/**
 * Hono `/checkin` routes — mirror apps/api/src/modules/checkin/checkin.controller.ts.
 *
 * `POST /` returns 201 (matches Nest's `@HttpCode(HttpStatus.CREATED)`).
 * On a same-day double-claim the service throws `DomainError(409)`, which
 * the Worker's `app.onError` maps to the standard envelope.
 *
 * Per-user rate limiting (Nest has `@Throttle({default: {limit: 5, ttl:
 * 60_000}})`) is deferred to a Cloudflare Rate Limiting / KV-backed task —
 * out of scope for this PR.
 */
import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import type { WorkerEnv } from '../services/auth-factory';
import { makeCheckinService, makeCoinsService } from '../services/user-factory';

type Bindings = WorkerEnv;
type Variables = PrismaVariables & AuthVariables;

export const checkinRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', requireAuth)
  .get('/status', async (c) => {
    const user = c.get('user');
    const prisma = c.get('prisma');
    const checkin = makeCheckinService(prisma, makeCoinsService(prisma));
    return c.json(await checkin.getStatus(user.id), 200);
  })
  .post('/', async (c) => {
    const user = c.get('user');
    const prisma = c.get('prisma');
    const checkin = makeCheckinService(prisma, makeCoinsService(prisma));
    return c.json(await checkin.claim(user.id), 201);
  });
