/**
 * Builds Books / Chapters service instances for the Cloudflare Worker.
 * Mirrors the `useFactory` providers in the Nest modules but uses Worker
 * replacements: a no-op CacheClient (no Redis) and a R2-binding-backed
 * StorageClient (preferred over the S3 SDK when the binding is present).
 *
 * The same `*.service.ts` files run on both stacks — the Worker just
 * supplies different concrete dependencies.
 */
import type { PrismaClient } from '@prisma/client';

import { BooksService } from '../../modules/books/books.service';
import { ChaptersService } from '../../modules/chapters/chapters.service';
import { NoopCacheClient } from './no-op-cache';
import { WorkerR2StorageClient } from './r2-storage';
import type { WorkerEnv } from './auth-factory';

export function makeBooksService(env: WorkerEnv, prisma: PrismaClient): BooksService {
  void env;
  return new BooksService({ prisma, cache: new NoopCacheClient() });
}

export function makeChaptersService(env: WorkerEnv, prisma: PrismaClient): ChaptersService {
  return new ChaptersService({
    prisma,
    storage: new WorkerR2StorageClient(env),
    cache: new NoopCacheClient(),
  });
}
