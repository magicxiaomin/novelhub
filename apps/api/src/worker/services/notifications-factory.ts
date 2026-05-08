/**
 * Builds NotificationsService + OneSignalClient instances for the
 * Cloudflare Worker runtime. Mirrors the `useFactory` providers in
 * notifications.module.ts.
 *
 * Used exclusively by the `scheduled()` handler in worker.ts; no Hono
 * routes consume notifications yet (the user-facing /notifications/grant-bonus
 * endpoint is deferred until the FB CAPI port lands in a later task).
 */
import type { PrismaClient } from '@prisma/client';

import { CoinsService } from '../../modules/coins/coins.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { OneSignalClient } from '../../modules/notifications/one-signal.client';

import type { WorkerEnv as BaseWorkerEnv } from './auth-factory';

export type NotificationsWorkerEnv = BaseWorkerEnv & {
  ONESIGNAL_REST_API_KEY?: string;
  NEXT_PUBLIC_ONESIGNAL_APP_ID?: string;
};

export function makeNotificationsService(
  env: NotificationsWorkerEnv,
  prisma: PrismaClient,
): NotificationsService {
  const oneSignal = new OneSignalClient({
    apiKey: env.ONESIGNAL_REST_API_KEY,
    appId: env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
  });
  const coins = new CoinsService({ prisma });
  return new NotificationsService({ prisma, coins, oneSignal });
}
