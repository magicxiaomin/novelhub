/**
 * Cloudflare Workers entrypoint — Task 2 scaffold.
 *
 * This is the `fetch` + `scheduled` shell that subsequent migration tasks
 * (3 = auth, 4 = catalog, 5 = storage, …) layer their routes onto. For now,
 * only `/health` is wired so we can verify the Worker boots and responds.
 *
 * The existing NestJS app under apps/api/src/{main,app,modules}/* is NOT
 * affected — both stacks coexist until Task 12 swings DNS to the Worker.
 */
import { Hono } from 'hono';
import APP_NAME from '@novelhub/shared';

// Subset of the Cloudflare env we'll layer on. Real bindings come in later
// tasks; this empty type is intentional — workers-types fills the rest.
type Env = Record<string, never>;

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

const app = new Hono<{ Bindings: Env }>();

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

// Scheduled handler stub. Task 8 dispatches by event.cron string. Until then
// every cron tick is a no-op so a pre-prod cron deploy can't break anything.
async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  void event;
  void env;
  void ctx;
}

export default {
  fetch: app.fetch,
  scheduled,
};
