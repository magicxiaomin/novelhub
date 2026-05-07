import type { PrismaClient } from '@prisma/client';

// Use transaction-level advisory locks so the lock is auto-released when the
// wrapping transaction ends. Session-level locks (`pg_try_advisory_lock`) leak
// across pooled connections: the unlock can land on a different backend session
// than the one holding the lock, leaving the lock held until the original
// connection is recycled — silently skipping every subsequent cron tick.
export async function withCronLock<T>(
  prisma: PrismaClient,
  lockKey: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  return prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) AS acquired
    `;
    if (!lock?.acquired) return null;
    return fn();
  });
}
