import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(__dirname, '..', '..', '..');
const sharedMessagesRoot = join(repoRoot, 'packages/shared/src/messages');

const activeCopyFiles = [
  'apps/web/src/components/reader/top-bar.tsx',
  'apps/web/src/components/reader/bottom-bar.tsx',
  'apps/web/src/components/reader/chapter-list-drawer.tsx',
  'apps/web/src/app/novels/page.tsx',
];

const FORBIDDEN_SUBSTRINGS = ['drama', 'episode', 'watch', 'video', 'stream', 'series'];

function listSharedMessageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSharedMessageFiles(path);
    }
    return ['.json', '.ts'].includes(extname(entry.name)) ? [path] : [];
  });
}

function forbiddenMatches(path: string): string[] {
  const content = readFileSync(path, 'utf8').toLowerCase();
  return FORBIDDEN_SUBSTRINGS.filter((substring) => content.includes(substring.toLowerCase()));
}

describe('copy guard for shared messages and active reader/novels files', () => {
  it('keeps forbidden short-drama copy out of shared message files', () => {
    const files = listSharedMessageFiles(sharedMessagesRoot);

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(forbiddenMatches(file), relative(repoRoot, file)).toEqual([]);
    }
  });

  it('keeps forbidden short-drama copy out of the active reader and novels allowlist', () => {
    // Issue #365 owns the broader import-side guard; this spec only checks explicit active copy files.
    for (const file of activeCopyFiles) {
      const path = join(repoRoot, file);
      expect(forbiddenMatches(path), file).toEqual([]);
    }
  });
});
