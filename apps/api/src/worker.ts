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
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from './common/domain.errors';
import { corsAllowedOrigins } from './config/domain';
import { prismaMiddleware } from './worker/db/prisma';
import type { AuthVariables } from './worker/middleware/auth';
import { withCronLock } from './modules/notifications/cron/leader-election';
import { adminRoutes } from './worker/routes/admin';
import { authRoutes } from './worker/routes/auth';
import { booksRoutes } from './worker/routes/books';
import { chaptersRoutes } from './worker/routes/chapters';
import { checkinRoutes } from './worker/routes/checkin';
import { coinsRoutes } from './worker/routes/coins';
import { dramaProgressRoutes } from './worker/routes/drama-progress';
import { dramasRoutes } from './worker/routes/dramas';
import { episodesRoutes } from './worker/routes/episodes';
import { paymentsRoutes } from './worker/routes/payments';
import { readingProgressRoutes } from './worker/routes/reading-progress';
import { unlocksRoutes } from './worker/routes/unlocks';
import { webhookRoutes } from './worker/routes/webhook';
import { makePrisma } from './worker/db/prisma';
import { Sentry, buildSentryOptions, captureWorkerException } from './worker/sentry';
import type { AdminWorkerEnv } from './worker/services/admin-factory';
import {
  makeNotificationsService,
  type NotificationsWorkerEnv,
} from './worker/services/notifications-factory';
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

type AppEnv = PaymentsWorkerEnv & NotificationsWorkerEnv & AdminWorkerEnv;

const app = new Hono<{ Bindings: AppEnv; Variables: Partial<AuthVariables> }>();

// CORS — mirror Phase 1 Nest's `app.enableCors({ origin: NEXT_PUBLIC_APP_URL,
// credentials: true })`. The Pages frontend at *.pages.dev is cross-origin
// to the Worker at *.workers.dev, so credentialed fetches need a preflight
// allow + Set-Cookie's Access-Control-Allow-Credentials echo. Allowlist is
// driven by NEXT_PUBLIC_APP_URL (single canonical origin) plus an optional
// CORS_EXTRA_ORIGINS comma-separated env for staging/preview hosts. Mounted
// before prismaMiddleware so OPTIONS preflights don't open a Prisma client.
app.use('*', async (c, next) => {
  const allowed = new Set(corsAllowedOrigins(c.env));
  return cors({
    origin: (origin) => (origin && allowed.has(origin) ? origin : null),
    credentials: true,
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'X-Ratelimit-Remaining', 'X-Ratelimit-Reset'],
    maxAge: 600,
  })(c, next);
});

// Mirrors apps/api/src/app.controller.ts — same envelope shape so the
// frontend health probe / UptimeRobot keyword match keeps working when DNS
// flips to the Worker. Opens a per-request Prisma client inline (not via
// the `prismaMiddleware` chain) so the probe still answers `db: 'fail'`
// when the DB is unreachable instead of bubbling a 500.
app.get('/health', async (c) => {
  let db: 'ok' | 'fail' = 'fail';
  if (c.env.DATABASE_URL) {
    const { prisma, pool } = makePrisma(c.env.DATABASE_URL);
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch {
      db = 'fail';
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
  const body: HealthResponse = {
    app: APP_NAME,
    status: db === 'ok' ? 'ok' : 'degraded',
    db,
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
app.use('/dramas/*', prismaMiddleware);
app.use('/drama-progress/*', prismaMiddleware);
app.use('/episodes/*', prismaMiddleware);
app.use('/coins/*', prismaMiddleware);
app.use('/unlocks/*', prismaMiddleware);
app.use('/reading-progress/*', prismaMiddleware);
app.use('/checkin/*', prismaMiddleware);
app.use('/payments/*', prismaMiddleware);
app.use('/admin/*', prismaMiddleware);
app.route('/auth', authRoutes);
app.route('/books', booksRoutes);
app.route('/chapters', chaptersRoutes);
app.route('/dramas', dramasRoutes);
app.route('/drama-progress', dramaProgressRoutes);
app.route('/episodes', episodesRoutes);
app.route('/coins', coinsRoutes);
app.route('/unlocks', unlocksRoutes);
app.route('/reading-progress', readingProgressRoutes);
app.route('/checkin', checkinRoutes);
app.route('/admin', adminRoutes);
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
//   - Anything else: log + 500 + capture in Sentry (Task 10).
//
// Sentry capture is gated on the same 5xx rule as SentryExceptionFilter:
// 4xx user errors stay out, 5xx + unknown go in. `captureWorkerException`
// short-circuits when SENTRY_DSN is unset.
app.onError((err, c) => {
  if (err instanceof DomainError) {
    captureWorkerException(err, c.env);
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
    if (err.status >= 500) captureWorkerException(err, c.env);
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
  captureWorkerException(err, c.env);
  return c.json(
    { statusCode: 500, message: 'Internal Server Error', error: 'Internal Server Error' },
    500,
  );
});

// Cron schedules — keep these in sync with `[triggers].crons` in
// wrangler.toml. The Workers runtime delivers `event.cron` as the literal
// schedule string from the config, so we dispatch by direct equality.
const CRON_RE_ENGAGEMENT = '0 */6 * * *';
const CRON_RENEWAL_REMINDER = '0 9 * * *';

// Distinct advisory-lock keys per cron path so a stuck re-engagement run
// can't block renewal reminders. Values intentionally match the Nest cron
// classes (12001 / 12002) so a hybrid Nest+Worker deployment doesn't try
// to run the same cron twice in parallel.
const RE_ENGAGEMENT_LOCK_KEY = 12001;
const RENEWAL_REMINDER_LOCK_KEY = 12002;

type WorkerEnvForScheduled = AppEnv;

/**
 * Scheduled handler — Cloudflare invokes this on each `[triggers].crons`
 * tick. The body opens one Prisma client, calls the matching cron via
 * `withCronLock` (transaction-level advisory lock so duplicate Worker
 * instances don't double-run), and tears the connection down.
 *
 * `ctx.waitUntil` extends the Worker's lifetime past the immediate
 * response so a cron run that takes >1s isn't truncated.
 */
async function scheduled(
  event: ScheduledController,
  env: WorkerEnvForScheduled,
  ctx: ExecutionContext,
): Promise<void> {
  const work = (async (): Promise<void> => {
    const { prisma, pool } = makePrisma(env.DATABASE_URL ?? '');
    try {
      const notifications = makeNotificationsService(env, prisma);
      switch (event.cron) {
        case CRON_RE_ENGAGEMENT:
          await withCronLock(prisma, RE_ENGAGEMENT_LOCK_KEY, () =>
            notifications.sendReEngagement(),
          );
          break;
        case CRON_RENEWAL_REMINDER:
          await withCronLock(prisma, RENEWAL_REMINDER_LOCK_KEY, () =>
            notifications.sendRenewalReminders(),
          );
          break;
        default:
          // eslint-disable-next-line no-console
          console.warn(`[worker.scheduled] unknown cron schedule: ${event.cron}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[worker.scheduled] cron ${event.cron} failed:`, err);
    } finally {
      await pool.end().catch(() => undefined);
    }
  })();
  ctx.waitUntil(work);
}

// Wrap the handler with Sentry's per-request hub so unhandled throws
// auto-capture and `getIsolationScope().setUser` from auth middleware
// pins the right user context per request. The options factory reads
// `env.SENTRY_DSN`; when it's unset, withSentry stays a no-op.
export default Sentry.withSentry<AppEnv>((env) => buildSentryOptions(env), {
  fetch: app.fetch,
  scheduled,
});
