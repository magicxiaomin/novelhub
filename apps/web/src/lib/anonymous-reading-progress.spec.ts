import { describe, expect, it, vi } from 'vitest';

import {
  ANONYMOUS_READING_PROGRESS_KEY,
  loadAnonymousBookProgress,
  loadAnonymousChapterProgress,
  loadAnonymousReadingProgress,
  saveAnonymousReadingProgress,
} from './anonymous-reading-progress';
import type { ReadingProgressEntry } from './types';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const entry = (overrides: Partial<ReadingProgressEntry> = {}): ReadingProgressEntry => ({
  bookId: 'book-1',
  chapterId: 'chapter-1',
  chapterNumber: 3,
  scrollPercent: 42,
  bookTitle: 'The Last Ember',
  bookCover: '/covers/ember.svg',
  updatedAt: '2026-05-18T00:00:00.000Z',
  ...overrides,
});

describe('anonymous reading progress storage', () => {
  it('round-trips progress entries and returns newest entries first', () => {
    const storage = new MemoryStorage();

    saveAnonymousReadingProgress(
      storage,
      entry({ bookId: 'older', updatedAt: '2026-05-17T00:00:00.000Z' }),
    );
    saveAnonymousReadingProgress(
      storage,
      entry({ bookId: 'newer', updatedAt: '2026-05-18T00:00:00.000Z' }),
    );

    expect(loadAnonymousReadingProgress(storage).map((item) => item.bookId)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('updates an existing book/chapter instead of duplicating it', () => {
    const storage = new MemoryStorage();

    saveAnonymousReadingProgress(storage, entry({ scrollPercent: 10 }));
    saveAnonymousReadingProgress(storage, entry({ scrollPercent: 64 }));

    expect(loadAnonymousReadingProgress(storage)).toEqual([entry({ scrollPercent: 64 })]);
    expect(loadAnonymousChapterProgress(storage, 'book-1', 'chapter-1')?.scrollPercent).toBe(64);
  });

  it('returns the newest anonymous progress entry for a book', () => {
    const storage = new MemoryStorage();

    saveAnonymousReadingProgress(
      storage,
      entry({ bookId: 'book-1', chapterId: 'chapter-1', chapterNumber: 1 }),
    );
    saveAnonymousReadingProgress(
      storage,
      entry({ bookId: 'book-2', chapterId: 'chapter-2', chapterNumber: 2 }),
    );
    saveAnonymousReadingProgress(
      storage,
      entry({
        bookId: 'book-1',
        chapterId: 'chapter-3',
        chapterNumber: 3,
        updatedAt: '2026-05-19T00:00:00.000Z',
      }),
    );

    expect(loadAnonymousBookProgress(storage, 'book-1')?.chapterNumber).toBe(3);
    expect(loadAnonymousBookProgress(storage, 'missing')).toBeNull();
  });

  it('returns an empty shelf for corrupt non-JSON payloads without logging', () => {
    const storage = new MemoryStorage();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.setItem(ANONYMOUS_READING_PROGRESS_KEY, '{not-json');

    expect(loadAnonymousReadingProgress(storage)).toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('falls back to empty progress for schema-version mismatched payloads', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      ANONYMOUS_READING_PROGRESS_KEY,
      JSON.stringify({ schemaVersion: 0, entries: [entry()] }),
    );

    expect(loadAnonymousReadingProgress(storage)).toEqual([]);
    expect(loadAnonymousBookProgress(storage, 'book-1')).toBeNull();
    expect(loadAnonymousChapterProgress(storage, 'book-1', 'chapter-1')).toBeNull();
  });

  it('is safe when storage is unavailable during SSR', () => {
    expect(loadAnonymousReadingProgress(null)).toEqual([]);
    expect(loadAnonymousChapterProgress(undefined, 'book-1', 'chapter-1')).toBeNull();
    expect(() => saveAnonymousReadingProgress(undefined, entry())).not.toThrow();
  });

  it('swallows storage read failures and falls back to empty progress', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('Blocked by privacy settings', 'SecurityError');
      }),
      setItem: vi.fn(),
    } satisfies Pick<Storage, 'getItem' | 'setItem'>;

    expect(loadAnonymousReadingProgress(storage)).toEqual([]);
    expect(loadAnonymousBookProgress(storage, 'book-1')).toBeNull();
    expect(loadAnonymousChapterProgress(storage, 'book-1', 'chapter-1')).toBeNull();
    expect(storage.getItem).toHaveBeenCalledWith(ANONYMOUS_READING_PROGRESS_KEY);
  });

  it('rejects shape-mismatched array entries without preserving partial data', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      ANONYMOUS_READING_PROGRESS_KEY,
      JSON.stringify([
        entry(),
        {
          bookId: 'bad-book',
          chapterId: 'chapter-2',
          chapterNumber: '2',
          scrollPercent: 25,
          bookTitle: 'Bad Book',
          bookCover: '/covers/bad.svg',
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      ]),
    );

    expect(loadAnonymousReadingProgress(storage)).toEqual([]);
    expect(loadAnonymousBookProgress(storage, 'book-1')).toBeNull();
    expect(loadAnonymousChapterProgress(storage, 'book-1', 'chapter-1')).toBeNull();
  });

  it('keeps the v1 record shape unchanged on the happy path', () => {
    const storage = new MemoryStorage();
    const progress = entry({ scrollPercent: 88 });

    saveAnonymousReadingProgress(storage, progress);

    expect(JSON.parse(storage.getItem(ANONYMOUS_READING_PROGRESS_KEY) ?? '')).toEqual([progress]);
  });

  it('retries quota-exceeded writes by dropping the oldest progress entry', () => {
    const storage = new MemoryStorage();
    saveAnonymousReadingProgress(
      storage,
      entry({
        bookId: 'oldest',
        chapterId: 'chapter-oldest',
        updatedAt: '2026-05-16T00:00:00.000Z',
      }),
    );
    saveAnonymousReadingProgress(
      storage,
      entry({ bookId: 'newer', chapterId: 'chapter-newer', updatedAt: '2026-05-17T00:00:00.000Z' }),
    );
    const setItemSpy = vi.spyOn(storage, 'setItem');
    setItemSpy.mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() =>
      saveAnonymousReadingProgress(
        storage,
        entry({
          bookId: 'newest',
          chapterId: 'chapter-newest',
          updatedAt: '2026-05-18T00:00:00.000Z',
        }),
      ),
    ).not.toThrow();

    expect(setItemSpy).toHaveBeenCalledTimes(2);
    expect(loadAnonymousReadingProgress(storage).map((item) => item.bookId)).toEqual([
      'newest',
      'newer',
    ]);
  });

  it('swallows repeated quota-exceeded write failures without clearing existing progress', () => {
    const storage = new MemoryStorage();
    saveAnonymousReadingProgress(storage, entry({ scrollPercent: 12 }));
    const setItemSpy = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => saveAnonymousReadingProgress(storage, entry({ scrollPercent: 88 }))).not.toThrow();

    setItemSpy.mockRestore();
    expect(loadAnonymousReadingProgress(storage)).toEqual([entry({ scrollPercent: 12 })]);
  });

  it('uses last-write-wins semantics for concurrent-tab style updates without crashing', () => {
    const storage = new MemoryStorage();
    const tabOneSnapshot = JSON.stringify([
      entry({ chapterId: 'chapter-1', scrollPercent: 25, updatedAt: '2026-05-18T00:00:00.000Z' }),
    ]);
    const tabTwoSnapshot = JSON.stringify([
      entry({ chapterId: 'chapter-2', scrollPercent: 50, updatedAt: '2026-05-18T00:01:00.000Z' }),
    ]);

    expect(() => {
      storage.setItem(ANONYMOUS_READING_PROGRESS_KEY, tabOneSnapshot);
      storage.setItem(ANONYMOUS_READING_PROGRESS_KEY, tabTwoSnapshot);
    }).not.toThrow();

    expect(loadAnonymousReadingProgress(storage)).toEqual([
      entry({ chapterId: 'chapter-2', scrollPercent: 50, updatedAt: '2026-05-18T00:01:00.000Z' }),
    ]);
  });
});
