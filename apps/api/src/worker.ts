/**
 * Cloudflare Workers entrypoint.
 *
 * Task 2 scaffolded the `fetch` + `scheduled` shell. Task 3.1 layers in the
 * Hono auth route group (register / login / refresh / logout / me /
 * forgot-password / reset-password) backed by the factory-shape `AuthService`
 * from apps/api/src/modules/auth/. Subsequent tasks (4 = catalog, 5 =
 * storage, …) mount more route groups on the same `app` instance.
 *
 * The existing NestJS app under apps/api/src/{main,app,modules}/* is NOT
 * affected — both stacks coexist until Task 12 swings DNS to the Worker.
 */
import APP_NAME from '@novelhub/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { AuthError } from './modules/auth/auth.errors';
import { prismaMiddleware } from './worker/db/prisma';
import type { AuthVariables } from './worker/middleware/auth';
import { authRoutes } from './worker/routes/auth';
import type { WorkerEnv } from './worker/services/auth-factory';

type HealthResponse = {
  app: typeof APP_NAME;
  status: 'ok' | 'degraded';
  db: 'ok' | 'fail' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
};

// Worker isolates can persist module state across requests within their
// lifetime; this matches the Nest STARTED_AT semantic for /health.uptime.
const STARTED_AT = Date.now();

const app = new Hono<{ Bindings: WorkerEnv; Variables: Partial<AuthVariables> }>();

// Mirrors apps/api/src/app.controller.ts — same envelope shape so the
// frontend health probe / UptimeRobot keyword match keeps working when DNS
// flips to the Worker. `db: 'degraded'` until Task 4 wires Hyperdrive +
// Prisma, where this becomes a real `SELECT 1`.
app.get('/health', (c) => {
  const body: HealthResponse = {
    app: APP_NAME,
    status: 'degraded',
    db: 'degraded',
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});

// Open one Prisma client per /auth/* request and tear it down after the
// handler resolves. Keeps connection lifetimes bounded so the pg.Pool
// can't leak across miniflare isolate reuse.
app.use('/auth/*', prismaMiddleware);
app.route('/auth', authRoutes);

// Mirrors apps/api/src/modules/auth/auth-error.filter.ts: AuthService throws
// runtime-agnostic AuthError; we map back to the HTTP status here. Other
// thrown errors fall through to Hono's default 500 unless they're already
// HTTPException instances.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  if (err instanceof AuthError) {
    return c.json({ message: err.message }, err.status);
  }
  // eslint-disable-next-line no-console
  console.error('[worker] unhandled error', err);
  return c.json({ message: 'Internal Server Error' }, 500);
});

// Scheduled handler stub. Task 8 dispatches by event.cron string. Until then
// every cron tick is a no-op so a pre-prod cron deploy can't break anything.
async function scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) {
  void event;
  void env;
  void ctx;
}

export default {
  fetch: app.fetch,
  scheduled,
};
