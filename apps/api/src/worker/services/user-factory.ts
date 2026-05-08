/**
 * Builds the user-scoped service instances (Coins, Unlocks, ReadingProgress,
 * Checkin) for the Cloudflare Worker runtime. Mirrors the `useFactory`
 * providers in the Nest modules but constructs services directly per
 * request — Hono has no DI container.
 *
 * `UnlocksService` and `CheckinService` depend on `CoinsService`; both
 * factories accept a shared `CoinsService` instance so the per-request
 * Prisma client is consumed exactly once. This keeps the spend-then-write
 * transaction within a single connection scope.
 */
import type { PrismaClient } from '@prisma/client';

import { CheckinService } from '../../modules/checkin/checkin.service';
import { CoinsService } from '../../modules/coins/coins.service';
import { ReadingProgressService } from '../../modules/reading-progress/reading-progress.service';
import { UnlocksService } from '../../modules/unlocks/unlocks.service';

export function makeCoinsService(prisma: PrismaClient): CoinsService {
  return new CoinsService({ prisma });
}

export function makeUnlocksService(prisma: PrismaClient, coins: CoinsService): UnlocksService {
  return new UnlocksService({ prisma, coins });
}

export function makeReadingProgressService(prisma: PrismaClient): ReadingProgressService {
  return new ReadingProgressService({ prisma });
}

export function makeCheckinService(prisma: PrismaClient, coins: CoinsService): CheckinService {
  return new CheckinService({ prisma, coins });
}
