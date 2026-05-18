import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { messages } from '@novelhub/shared';

const appDir = join(process.cwd(), 'src/app');

function readAppFile(path: string): string {
  return readFileSync(join(appDir, path), 'utf8');
}

describe('novels and reader route boundaries', () => {
  it('defines localized not-found and error messages for novels and reader routes', () => {
    expect(messages.errors.novelsNotFound).toBe('Novels unavailable');
    expect(messages.errors.novelsNotFoundBody).toContain('Browse will be back');
    expect(messages.errors.readerNotFound).toBe('Chapter not found');
    expect(messages.errors.readerNotFoundBody).toContain('chapter may have moved');
    expect(messages.errors.backToNovels).toBe('Back to novels');
    expect(messages.errors.routeBoundaryReset).toBe('Try again');
  });

  it('adds route-segment not-found boundaries for novels and reader routes', () => {
    for (const route of ['novels/not-found.tsx', 'read/[bookId]/[chapterNumber]/not-found.tsx']) {
      expect(existsSync(join(appDir, route))).toBe(true);
      const source = readAppFile(route);
      expect(source).toContain('messages.errors.');
      expect(source).toContain('<AppShell>');
    }
  });

  it('adds client error boundaries with reset and back navigation for novels and reader routes', () => {
    for (const route of ['novels/error.tsx', 'read/[bookId]/[chapterNumber]/error.tsx']) {
      const source = readAppFile(route);
      expect(source).toMatch(/^'use client';/);
      expect(source).toContain('reset');
      expect(source).toContain('messages.errors.routeBoundaryReset');
      expect(source).toContain('<AppShell>');
      expect(source).toContain('href=');
    }
  });

  it('preserves the existing novels empty state copy path', () => {
    const source = readAppFile('novels/page.tsx');

    expect(source).toContain('messages.novels.emptyTitle');
    expect(source).toContain('messages.novels.emptyBody');
  });
});
