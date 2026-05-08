/**
 * Builds AdminService for the Cloudflare Worker. Mirrors the useFactory
 * provider in admin.module.ts but pulls all env-derived config from the
 * Worker env bag and reuses the Worker-side BooksService factory.
 */
import type { PrismaClient } from '@prisma/client';

import { AdminService } from '../../modules/admin/admin.service';
import { BooksService } from '../../modules/books/books.service';

import { NoopCacheClient } from './no-op-cache';
import { WorkerR2StorageClient } from './r2-storage';
import type { WorkerEnv as BaseWorkerEnv } from './auth-factory';

export type AdminWorkerEnv = BaseWorkerEnv & {
  R2_PUBLIC_HOST?: string;
  NEXT_PUBLIC_R2_PUBLIC_HOST?: string;
};

export function makeAdminService(env: AdminWorkerEnv, prisma: PrismaClient): AdminService {
  const cache = new NoopCacheClient();
  // BooksService is constructed inline (not via the catalog factory) so the
  // Admin path doesn't carry dependencies the catalog read path doesn't need.
  const books = new BooksService({ prisma, cache });
  return new AdminService({
    prisma,
    storage: new WorkerR2StorageClient(env),
    cache,
    books,
    publicR2Host: env.R2_PUBLIC_HOST ?? env.NEXT_PUBLIC_R2_PUBLIC_HOST,
  });
}
