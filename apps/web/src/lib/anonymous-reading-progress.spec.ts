import { describe, expect, it, vi } from 'vitest';

import {
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

  it('returns an empty shelf for corrupt payloads without logging', () => {
    const storage = new MemoryStorage();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.setItem('novelhub:anonymous-reading-progress:v1', '{not-json');

    expect(loadAnonymousReadingProgress(storage)).toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('is safe when storage is unavailable during SSR', () => {
    expect(loadAnonymousReadingProgress(null)).toEqual([]);
    expect(loadAnonymousChapterProgress(undefined, 'book-1', 'chapter-1')).toBeNull();
    expect(() => saveAnonymousReadingProgress(undefined, entry())).not.toThrow();
  });
});
