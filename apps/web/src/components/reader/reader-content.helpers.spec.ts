import { describe, expect, it, vi } from 'vitest';

import {
  calculateReaderScrollProgress,
  getReaderKeyboardShortcutAction,
  isReaderKeyboardShortcutTarget,
  loadReaderScrollRestoreY,
  prefetchAdjacentReaderRoutes,
  readerScrollRestoreKey,
} from './reader-content';

function createMemoryStorage(
  initialEntries: ReadonlyArray<readonly [string, string]> = [],
): Storage {
  const entries = new Map<string, string>(initialEntries);
  return {
    get length() {
      return entries.size;
    },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(entries.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => entries.delete(key)),
    setItem: vi.fn((key: string, value: string) => entries.set(key, value)),
  };
}

describe('calculateReaderScrollProgress', () => {
  it('rounds the scroll percentage and clamps underflow and overflow', () => {
    expect(
      calculateReaderScrollProgress({ scrollY: -1, scrollHeight: 1000, innerHeight: 500 }),
    ).toBe(0);
    expect(
      calculateReaderScrollProgress({ scrollY: 249, scrollHeight: 1000, innerHeight: 500 }),
    ).toBe(50);
    expect(
      calculateReaderScrollProgress({ scrollY: 999, scrollHeight: 1000, innerHeight: 500 }),
    ).toBe(100);
  });

  it('treats non-scrollable documents as fully read', () => {
    expect(calculateReaderScrollProgress({ scrollY: 0, scrollHeight: 400, innerHeight: 400 })).toBe(
      100,
    );
    expect(calculateReaderScrollProgress({ scrollY: 0, scrollHeight: 300, innerHeight: 400 })).toBe(
      100,
    );
  });

  it('treats zero-length reader content as complete rather than dividing by zero', () => {
    expect(calculateReaderScrollProgress({ scrollY: 0, scrollHeight: 0, innerHeight: 0 })).toBe(
      100,
    );
    expect(calculateReaderScrollProgress({ scrollY: 64, scrollHeight: 0, innerHeight: 640 })).toBe(
      100,
    );
  });
});

describe('reader scroll restore helpers', () => {
  it('uses route-scoped storage keys', () => {
    expect(readerScrollRestoreKey('/read/book-1/2')).toBe('novelhub:reader-scroll:/read/book-1/2');
  });

  it('keeps raw route path text in the restore key without normalization', () => {
    expect(readerScrollRestoreKey('/read/book%2Fwith%20space/12')).toBe(
      'novelhub:reader-scroll:/read/book%2Fwith%20space/12',
    );
  });

  it('loads a finite non-negative primary scroll value and consumes both restore slots', () => {
    const key = readerScrollRestoreKey('/read/book-1/2');
    const storage = createMemoryStorage([
      [key, '128.5'],
      [`${key}:last`, '64'],
    ]);

    expect(loadReaderScrollRestoreY('/read/book-1/2', storage)).toBe(128.5);
    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(storage.removeItem).toHaveBeenCalledWith(`${key}:last`);
    expect(loadReaderScrollRestoreY('/read/book-1/2', storage)).toBeNull();
  });

  it('falls back to the last route slot and ignores invalid scroll values', () => {
    const fallbackKey = readerScrollRestoreKey('/read/book-1/3');
    const invalidKey = readerScrollRestoreKey('/read/book-1/4');

    expect(
      loadReaderScrollRestoreY(
        '/read/book-1/3',
        createMemoryStorage([[`${fallbackKey}:last`, '24']]),
      ),
    ).toBe(24);
    expect(
      loadReaderScrollRestoreY('/read/book-1/4', createMemoryStorage([[invalidKey, '-1']])),
    ).toBeNull();
    expect(
      loadReaderScrollRestoreY('/read/book-1/4', createMemoryStorage([[invalidKey, 'NaN']])),
    ).toBeNull();
  });

  it('consumes both slots and does not fall back when a present primary scroll value is invalid', () => {
    const key = readerScrollRestoreKey('/read/book-1/5');
    const storage = createMemoryStorage([
      [key, 'NaN'],
      [`${key}:last`, '48'],
    ]);

    expect(loadReaderScrollRestoreY('/read/book-1/5', storage)).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(storage.removeItem).toHaveBeenCalledWith(`${key}:last`);
  });
});

describe('prefetchAdjacentReaderRoutes', () => {
  it('prefetches only defined adjacent reader hrefs in previous then next order', () => {
    const router = { prefetch: vi.fn() };

    prefetchAdjacentReaderRoutes(router, { prevHref: null, nextHref: '/read/book-1/3' });
    prefetchAdjacentReaderRoutes(router, { prevHref: '/read/book-1/1', nextHref: null });

    expect(router.prefetch).toHaveBeenNthCalledWith(1, '/read/book-1/3');
    expect(router.prefetch).toHaveBeenNthCalledWith(2, '/read/book-1/1');
  });

  it('skips route prefetches for reduced-data user preferences', () => {
    const router = { prefetch: vi.fn() };
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { connection: { saveData: true } },
    });

    try {
      prefetchAdjacentReaderRoutes(router, {
        prevHref: '/read/book-1/1',
        nextHref: '/read/book-1/3',
      });
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }

    expect(router.prefetch).not.toHaveBeenCalled();
  });

  it('skips route prefetches for reduced-data media query preferences', () => {
    const router = { prefetch: vi.fn() };
    const originalMatchMedia = globalThis.matchMedia;
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({ matches: query === '(prefers-reduced-data: reduce)' })),
    });

    try {
      prefetchAdjacentReaderRoutes(router, {
        prevHref: '/read/book-1/1',
        nextHref: '/read/book-1/3',
      });
    } finally {
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
    }

    expect(router.prefetch).not.toHaveBeenCalled();
  });
});

describe('reader keyboard shortcut helpers', () => {
  it('maps navigation and help keys while leaving unrelated keys unhandled', () => {
    expect(getReaderKeyboardShortcutAction({ key: 'ArrowLeft' })).toBe('previous');
    expect(getReaderKeyboardShortcutAction({ key: 'ArrowRight' })).toBe('next');
    expect(getReaderKeyboardShortcutAction({ key: '?' })).toBe('help');
    expect(getReaderKeyboardShortcutAction({ key: 'h' })).toBe('help');
    expect(getReaderKeyboardShortcutAction({ key: 'H', shiftKey: true })).toBe('help');
    expect(getReaderKeyboardShortcutAction({ key: 'Escape' })).toBe('close-help');
    expect(getReaderKeyboardShortcutAction({ key: 'ArrowUp' })).toBeNull();
  });

  it('ignores editable event targets and accepts non-editable or unknown targets', () => {
    expect(isReaderKeyboardShortcutTarget(null)).toBe(true);
    expect(isReaderKeyboardShortcutTarget({} as EventTarget)).toBe(true);
    expect(
      isReaderKeyboardShortcutTarget({ tagName: 'INPUT', isContentEditable: false } as HTMLElement),
    ).toBe(false);
    expect(
      isReaderKeyboardShortcutTarget({
        tagName: 'TEXTAREA',
        isContentEditable: false,
      } as HTMLElement),
    ).toBe(false);
    expect(
      isReaderKeyboardShortcutTarget({ tagName: 'DIV', isContentEditable: true } as HTMLElement),
    ).toBe(false);
    expect(
      isReaderKeyboardShortcutTarget({
        tagName: 'BUTTON',
        isContentEditable: false,
      } as HTMLElement),
    ).toBe(true);
  });
});
