import type { PrismaClient } from '@prisma/client';

export async function withCronLock<T>(
  prisma: PrismaClient,
  lockKey: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const [lock] = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${lockKey}::bigint) AS acquired
  `;
  if (!lock?.acquired) return null;

  try {
    return await fn();
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${lockKey}::bigint)`;
  }
}
