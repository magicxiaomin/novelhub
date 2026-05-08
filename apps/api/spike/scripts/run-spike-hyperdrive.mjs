/*
 * Hyperdrive reference skeleton only.
 *
 * This script documents the intended follow-up validation path for Cloudflare
 * Hyperdrive. Running it requires `wrangler login`, a configured Hyperdrive
 * binding pointing at Supabase, and `wrangler dev`. That Worker-based run is
 * out of scope for this local driver-adapter spike.
 */

import { PrismaClient } from '../node_modules/.prisma/spike-client/index.js';
import { PrismaPg } from '@prisma/adapter-pg-worker';
import { Pool } from '@prisma/pg-worker';

export default {
  async fetch(_request, env) {
    const pool = new Pool(env.HYPERDRIVE.connectionString);
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
      const checks = [];

      checks.push({
        name: 'select1',
        detail: await prisma.$queryRaw`SELECT 1 AS ok`,
      });

      checks.push({
        name: 'book-findMany',
        detail: await prisma.book.findMany({
          where: { deletedAt: null },
          take: 5,
        }),
      });

      await prisma.$transaction(
        async (tx) => {
          await tx.book.count();
        },
        { isolationLevel: 'Serializable' },
      );
      checks.push({ name: 'serializable-tx', detail: 'committed' });

      const advisoryLock = await prisma.$transaction(async (tx) => {
        const [row] =
          await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(99999::bigint) AS acquired`;
        return row?.acquired;
      });
      checks.push({ name: 'advisory-lock', detail: advisoryLock });

      return Response.json({ ok: true, checks });
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  },
};
