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

import { DomainError } from './common/domain.errors';
import { prismaMiddleware } from './worker/db/prisma';
import type { AuthVariables } from './worker/middleware/auth';
import { authRoutes } from './worker/routes/auth';
import { booksRoutes } from './worker/routes/books';
import { chaptersRoutes } from './worker/routes/chapters';
import { checkinRoutes } from './worker/routes/checkin';
import { coinsRoutes } from './worker/routes/coins';
import { paymentsRoutes } from './worker/routes/payments';
import { readingProgressRoutes } from './worker/routes/reading-progress';
import { unlocksRoutes } from './worker/routes/unlocks';
import { webhookRoutes } from './worker/routes/webhook';
import type { PaymentsWorkerEnv } from './worker/services/payments-factory';

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

const app = new Hono<{ Bindings: PaymentsWorkerEnv; Variables: Partial<AuthVariables> }>();

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

// Open one Prisma client per request and tear it down after the handler
// resolves. Keeps connection lifetimes bounded so the pg.Pool can't leak
// across miniflare isolate reuse.
app.use('/auth/*', prismaMiddleware);
app.use('/books/*', prismaMiddleware);
app.use('/chapters/*', prismaMiddleware);
app.use('/coins/*', prismaMiddleware);
app.use('/unlocks/*', prismaMiddleware);
app.use('/reading-progress/*', prismaMiddleware);
app.use('/checkin/*', prismaMiddleware);
app.use('/payments/*', prismaMiddleware);
app.route('/auth', authRoutes);
app.route('/books', booksRoutes);
app.route('/chapters', chaptersRoutes);
app.route('/coins', coinsRoutes);
app.route('/unlocks', unlocksRoutes);
app.route('/reading-progress', readingProgressRoutes);
app.route('/checkin', checkinRoutes);
// Webhook is mounted under /payments so Stripe Dashboard URLs stay valid.
// Keep it after the other /payments routes so the path-prefix middleware
// still hits it; Hono picks the matching route by path, not order, but the
// auth-gating diff between paymentsRoutes (requires auth) and webhookRoutes
// (no auth) is enforced by each subapp's own middleware chain.
app.route('/payments', webhookRoutes);
app.route('/payments', paymentsRoutes);

// HTTP status text — mirrors apps/api/src/common/domain-error.filter.ts so
// both stacks emit the same `{statusCode, message, error, ...context}` body
// shape. Frontend error rendering keeps working identically against either
// origin during the cutover.
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

// Mirrors apps/api/src/common/domain-error.filter.ts. Three cases:
//   - DomainError: thrown by services on the runtime-agnostic path
//   - HTTPException: thrown by Hono internals (zValidator failures, the
//     auth middleware's 401, etc.). We unwrap the message + status and
//     render the same JSON envelope rather than Hono's default text body.
//   - Anything else: log + 500. Sentry is not yet wired into the Worker
//     (Task 18); until then, console errors land in `wrangler tail`.
app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json(
      {
        statusCode: err.status,
        message: err.message,
        error: STATUS_TEXT[err.status] ?? 'Error',
        ...(err.context ?? {}),
      },
      err.status,
    );
  }
  if (err instanceof HTTPException) {
    return c.json(
      {
        statusCode: err.status,
        message: err.message,
        error: STATUS_TEXT[err.status] ?? 'Error',
      },
      err.status,
    );
  }
  // eslint-disable-next-line no-console
  console.error('[worker] unhandled error', err);
  return c.json(
    { statusCode: 500, message: 'Internal Server Error', error: 'Internal Server Error' },
    500,
  );
});

// Scheduled handler stub. Task 8 dispatches by event.cron string. Until then
// every cron tick is a no-op so a pre-prod cron deploy can't break anything.
async function scheduled(event: ScheduledEvent, env: PaymentsWorkerEnv, ctx: ExecutionContext) {
  void event;
  void env;
  void ctx;
}

export default {
  fetch: app.fetch,
  scheduled,
};
