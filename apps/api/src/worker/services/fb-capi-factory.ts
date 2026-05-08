/**
 * Builds an `FbCapiService` instance for the Cloudflare Worker runtime.
 * Mirrors the `useFactory` provider in
 * apps/api/src/modules/fb-capi/fb-capi.module.ts. The service itself is
 * runtime-agnostic — it uses Web Crypto for SHA-256 hashing, so the same
 * source compiles under both Node 19+ and Workers.
 */
import type { PrismaClient } from '@prisma/client';

import { FbCapiService } from '../../modules/fb-capi/fb-capi.service';
import { FbPurchaseEventPublisher } from '../../modules/fb-capi/publishers/fb-purchase-event.publisher';

import type { WorkerEnv as BaseWorkerEnv } from './auth-factory';

export type FbCapiWorkerEnv = BaseWorkerEnv & {
  NEXT_PUBLIC_FB_PIXEL_ID?: string;
  FB_CAPI_ACCESS_TOKEN?: string;
  FB_TEST_EVENT_CODE?: string;
};

export function makeFbCapiService(env: FbCapiWorkerEnv, prisma: PrismaClient): FbCapiService {
  return new FbCapiService({
    prisma,
    pixelId: env.NEXT_PUBLIC_FB_PIXEL_ID,
    accessToken: env.FB_CAPI_ACCESS_TOKEN,
    testEventCode: env.FB_TEST_EVENT_CODE,
    isProduction: env.NODE_ENV === 'production',
  });
}

export function makeFbPurchaseEventPublisher(
  env: FbCapiWorkerEnv,
  prisma: PrismaClient,
): FbPurchaseEventPublisher {
  return new FbPurchaseEventPublisher({
    prisma,
    fbCapi: makeFbCapiService(env, prisma),
  });
}
