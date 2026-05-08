/**
 * Prisma client factory for the Cloudflare Workers runtime.
 *
 * Today (Task 3.1): uses `@prisma/adapter-pg` over a `pg.Pool` against a
 * raw `DATABASE_URL`. This works under `wrangler dev` (with the
 * `nodejs_compat` flag) and under any Node runtime.
 *
 * One client is created per request via the `prismaMiddleware` below. The
 * pool is ended after the request resolves so connections don't leak across
 * isolates — Workers' module-level state can persist between requests
 * within the same isolate, and a stale Pool would wedge subsequent calls
 * waiting on a connection that the previous request never released.
 *
 * Task 4 swaps the adapter pair to `@prisma/adapter-pg-worker` +
 * `@prisma/pg-worker` and points at `env.HYPERDRIVE.connectionString` so
 * production deploys benefit from Cloudflare Hyperdrive's pooling.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { MiddlewareHandler } from 'hono';
import { Pool } from 'pg';

import type { WorkerEnv } from '../services/auth-factory';

export type PrismaVariables = {
  prisma: PrismaClient;
  prismaPool: Pool;
};

export function makePrisma(databaseUrl: string): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

/**
 * Hono middleware that opens one Prisma client (+ underlying pg.Pool) per
 * request, sets them on `c.var`, and ends the pool when the handler
 * resolves. Mount before any route group that touches the DB.
 */
export const prismaMiddleware: MiddlewareHandler<{
  Bindings: WorkerEnv;
  Variables: PrismaVariables;
}> = async (c, next) => {
  const { prisma, pool } = makePrisma(c.env.DATABASE_URL ?? '');
  c.set('prisma', prisma);
  c.set('prismaPool', pool);
  try {
    await next();
  } finally {
    // `await prisma.$disconnect()` is unnecessary because `pool.end()` ends
    // every underlying connection; calling both can deadlock the adapter.
    await pool.end().catch(() => undefined);
  }
};
