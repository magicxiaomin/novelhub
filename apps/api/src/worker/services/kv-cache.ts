/**
 * Cloudflare KV-backed implementation of `CacheClient` for the Worker.
 *
 * Phase 1 scope (per docs/cloudflare-migration-phase0.md, Task 6): only the
 * **support contact rate-limit** path actually uses this cache on the Worker.
 * Book-list and chapter-preview caching stay no-op (NoopCacheClient) on the
 * Worker — KV's one-write-per-key-per-second cap would burn instantly on
 * the chapter-preview keyspace, and book lists are read frequently enough
 * that we'll layer Cache API + Hyperdrive Cache later (Phase 2).
 *
 * Values are JSON-stringified on write and JSON-parsed on read so callers
 * can store typed objects (the support service stores numeric counters; the
 * book-list service in the Nest stack stores arrays). TTL maps directly to
 * KV's `expirationTtl` (in seconds).
 */
import type { CacheClient } from '../../modules/cache/cache.constants';

// Minimal subset of the KV binding API. Avoids a runtime dep on
// @cloudflare/workers-types just to satisfy two interfaces.
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; expiration?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

// KV's minimum TTL is 60 seconds. Values below that throw at runtime, so
// silently bump them up — the cache is best-effort and a longer-than-asked
// hold is always safe (the read path rechecks any condition).
const KV_MIN_TTL_SECONDS = 60;

export class KvCacheClient implements CacheClient {
  constructor(private readonly kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.kv.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Value isn't JSON — treat as cache miss rather than crash. Should
      // never happen in practice since `set` is the only writer, but
      // defensive against ops manually putting raw strings into KV.
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    const expirationTtl =
      ttlSeconds && ttlSeconds > 0 ? Math.max(KV_MIN_TTL_SECONDS, ttlSeconds) : undefined;
    await this.kv.put(key, payload, expirationTtl ? { expirationTtl } : undefined);
  }

  async del(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}
