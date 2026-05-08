/**
 * No-op CacheClient for the Cloudflare Worker.
 *
 * The Nest stack falls back to this same always-miss behaviour when REDIS_URL
 * is unset (apps/api/src/modules/cache/redis.client.ts), so book + chapter
 * services tolerate cache misses by design. We intentionally do NOT wire
 * Cloudflare KV here — KV is one-write-per-key-per-second and the book list /
 * chapter preview keyspace would burn that budget. A future task may swap in
 * Workers KV for stable values (categories, featured) or Cache API for
 * URL-keyed entries; until then, every Worker-side read touches Postgres.
 */
import type { CacheClient } from '../../modules/cache/cache.constants';

export class NoopCacheClient implements CacheClient {
  async get<T>(_key: string): Promise<T | null> {
    void _key;
    return null;
  }

  async set<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {
    void _key;
    void _value;
    void _ttlSeconds;
  }

  async del(_key: string): Promise<void> {
    void _key;
  }
}
