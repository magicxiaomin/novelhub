import type { ChapterReadingProgress, ReadingProgressEntry } from './types';

export const ANONYMOUS_READING_PROGRESS_KEY = 'novelhub:anonymous-reading-progress:v1';
const MAX_ANONYMOUS_PROGRESS_ENTRIES = 20;

type OptionalStorage = Pick<Storage, 'getItem' | 'setItem'> | null | undefined;

export function loadAnonymousReadingProgress(storage: OptionalStorage): ReadingProgressEntry[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(ANONYMOUS_READING_PROGRESS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReadingProgressEntry).sort(byNewestFirst);
  } catch {
    return [];
  }
}

export function loadAnonymousChapterProgress(
  storage: OptionalStorage,
  bookId: string,
  chapterId: string,
): ChapterReadingProgress | null {
  let entry: ReadingProgressEntry | null = null;
  for (const item of loadAnonymousReadingProgress(storage)) {
    if (item.bookId === bookId && item.chapterId === chapterId) {
      entry = item;
      break;
    }
  }
  if (!entry) return null;
  return {
    id: `anonymous:${entry.bookId}:${entry.chapterId}`,
    bookId: entry.bookId,
    chapterId: entry.chapterId,
    scrollPercent: entry.scrollPercent,
    lastReadAt: entry.updatedAt,
  };
}

export function saveAnonymousReadingProgress(
  storage: OptionalStorage,
  entry: ReadingProgressEntry,
): void {
  if (!storage) return;

  try {
    const withoutCurrent = loadAnonymousReadingProgress(storage).filter(
      (item) => item.bookId !== entry.bookId || item.chapterId !== entry.chapterId,
    );
    const next = [entry, ...withoutCurrent]
      .sort(byNewestFirst)
      .slice(0, MAX_ANONYMOUS_PROGRESS_ENTRIES);
    storage.setItem(ANONYMOUS_READING_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // Anonymous progress is a best-effort browser convenience. Storage quota,
    // privacy-mode failures, or corrupt payloads should not break reading.
  }
}

function byNewestFirst(a: ReadingProgressEntry, b: ReadingProgressEntry): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function isReadingProgressEntry(value: unknown): value is ReadingProgressEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.bookId === 'string' &&
    typeof candidate.chapterId === 'string' &&
    typeof candidate.chapterNumber === 'number' &&
    isFiniteNumber(candidate.chapterNumber) &&
    typeof candidate.scrollPercent === 'number' &&
    isFiniteNumber(candidate.scrollPercent) &&
    candidate.scrollPercent >= 0 &&
    candidate.scrollPercent <= 100 &&
    typeof candidate.bookTitle === 'string' &&
    typeof candidate.bookCover === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    isFiniteNumber(Date.parse(candidate.updatedAt))
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && globalThis.isFinite(value);
}
