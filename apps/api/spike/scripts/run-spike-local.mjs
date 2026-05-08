import fs from 'node:fs';

import { PrismaClient } from '../node_modules/.prisma/spike-client/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const results = {
  startedAt: new Date().toISOString(),
  checks: [],
};

async function check(name, fn) {
  const t0 = Date.now();

  try {
    const detail = await fn();
    const ms = Date.now() - t0;
    results.checks.push({ name, pass: true, ms, detail });
    console.log(`  ✓ ${name} (${ms} ms) ${detail ?? ''}`);
  } catch (err) {
    const ms = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    results.checks.push({ name, pass: false, ms, error: message });
    console.log(`  ✗ ${name} (${ms} ms) - ${message}`);
  }
}

console.log('Prisma driver-adapter local spike');

await check('select1', async () => {
  const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
  const ok = Number(rows[0]?.ok);

  if (ok !== 1) {
    throw new Error('unexpected SELECT 1 result');
  }

  return 'returned 1';
});

await check('book-findMany', async () => {
  const books = await prisma.book.findMany({
    where: { deletedAt: null },
    take: 5,
  });

  return `found ${books.length} books`;
});

await check('serializable-tx', async () => {
  await prisma.$transaction(
    async (tx) => {
      await tx.book.count();
    },
    { isolationLevel: 'Serializable' },
  );

  return 'tx with isolationLevel Serializable committed';
});

await check('advisory-lock', async () => {
  const acquired = await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(99999::bigint) AS acquired`;
    return row?.acquired;
  });

  if (acquired !== true) {
    throw new Error('did not acquire advisory lock');
  }

  return 'pg_try_advisory_xact_lock(99999) acquired';
});

await prisma.$disconnect();
await pool.end();

results.endedAt = new Date().toISOString();
results.allPass = results.checks.every((checkResult) => checkResult.pass);
fs.writeFileSync('/tmp/spike-prisma-results.json', JSON.stringify(results, null, 2));

const passed = results.checks.filter((checkResult) => checkResult.pass).length;
console.log(`\n${results.allPass ? 'PASS' : 'FAIL'} — ${passed}/${results.checks.length}`);
process.exit(results.allPass ? 0 : 1);
