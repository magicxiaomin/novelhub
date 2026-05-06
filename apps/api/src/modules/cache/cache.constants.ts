export const CACHE_CLIENT = Symbol('CACHE_CLIENT');

export const BOOK_LIST_TTL_SECONDS = 5 * 60;
export const CHAPTER_PREVIEW_TTL_SECONDS = 60 * 60;

export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}
