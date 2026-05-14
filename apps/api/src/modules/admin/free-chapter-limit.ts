const DEFAULT_FREE_CHAPTER_LIMIT = 3;
const MIN_FREE_CHAPTER_LIMIT = 1;
const MAX_FREE_CHAPTER_LIMIT = 3;

export function configuredFreeChapterLimit(envValue = process.env.FREE_CHAPTER_LIMIT): number {
  const parsed = envValue ? Number.parseInt(envValue, 10) : DEFAULT_FREE_CHAPTER_LIMIT;
  if (!Number.isFinite(parsed)) return DEFAULT_FREE_CHAPTER_LIMIT;
  return clampFreeChapterLimit(parsed);
}

export function clampFreeChapterLimit(value: number): number {
  return Math.min(MAX_FREE_CHAPTER_LIMIT, Math.max(MIN_FREE_CHAPTER_LIMIT, value));
}
