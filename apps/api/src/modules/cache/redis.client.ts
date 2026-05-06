import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

import type { CacheClient } from './cache.constants';

/**
 * Redis-backed cache client.
 *
 * If `REDIS_URL` is unset we fall back to an in-process no-op cache so that
 * the API can boot in dev/test environments without Redis. The no-op path
 * always returns null on `get`, so callers must tolerate cache misses
 * (which they do — every cache use is a perf optimization, never load-bearing).
 */
export class RedisCacheClient implements CacheClient {
  private readonly logger = new Logger(RedisCacheClient.name);
  private readonly client: Redis | null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.client = null;
      this.logger.warn('REDIS_URL not set — cache disabled (always miss).');
      return;
    }
    this.client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (err) {
      this.logger.warn(`cache get failed (${key}): ${(err as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, payload);
      }
    } catch (err) {
      this.logger.warn(`cache set failed (${key}): ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`cache del failed (${key}): ${(err as Error).message}`);
    }
  }
}
