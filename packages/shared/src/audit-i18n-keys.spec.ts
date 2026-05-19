import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildI18nKeyAuditReport } from './audit-i18n-keys';

describe('buildI18nKeyAuditReport', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createTempRepo = (prefix: string): string => {
    const repoRoot = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(repoRoot);
    return repoRoot;
  };

  it('returns report-only active, quarantined, and missing buckets without orphanStyle or message mutation', () => {
    const repoRoot = createTempRepo('novelhub-i18n-audit-');
    const sourceDir = join(repoRoot, 'apps', 'web', 'src');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, 'page.tsx'),
      [
        "import { messages } from '@novelhub/shared';",
        "messages.nav.home.replaceAll('{name}', 'reader');",
        'messages.drama.title;',
        'messages.missing.copy;',
      ].join('\n'),
    );
    writeFileSync(
      join(sourceDir, 'page.spec.ts'),
      ["import { messages } from '@novelhub/shared';", 'messages.nav.library;'].join('\n'),
    );

    const messagesJson = {
      nav: { home: 'Home', library: 'Library', orphan: 'Dropped from v1 report' },
      drama: { title: 'Drama', cta: 'Watch now' },
    };
    const before = JSON.stringify(messagesJson);

    const report = buildI18nKeyAuditReport({ repoRoot, messages: messagesJson });

    expect(JSON.stringify(messagesJson)).toBe(before);
    expect(report.schemaVersion).toBe(2);
    expect(report.buckets as Record<string, unknown>).not.toHaveProperty('orphanStyle');
    expect(report.summary as Record<string, unknown>).not.toHaveProperty('orphanStyle');
    expect(report.buckets.active).toEqual([
      { key: 'nav.home', references: ['apps/web/src/page.tsx'] },
    ]);
    expect(report.buckets.quarantinedOnly).toEqual([
      { key: 'drama.cta', reason: 'matches quarantined prefix "drama"' },
    ]);
    expect(report.buckets.quarantinedReferenced).toEqual([
      {
        key: 'drama.title',
        references: ['apps/web/src/page.tsx'],
        reason: 'matches quarantined prefix "drama" but is still statically referenced',
      },
    ]);
    expect(report.buckets.missing).toEqual([
      { key: 'missing.copy', references: ['apps/web/src/page.tsx'] },
    ]);
    expect(report.summary).toEqual({
      active: 1,
      quarantinedOnly: 1,
      quarantinedReferenced: 1,
      missing: 1,
    });
    expect(report.limitations).toContain(
      'Unreferenced non-quarantine message keys are intentionally outside schemaVersion 2 report buckets.',
    );
  });

  it('uses the sidecar override when docs/pivot/i18n-quarantine-prefixes.json is present', () => {
    const repoRoot = createTempRepo('novelhub-i18n-audit-sidecar-');
    const sourceDir = join(repoRoot, 'apps', 'web', 'src');
    const sidecarDir = join(repoRoot, 'docs', 'pivot');
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(sidecarDir, { recursive: true });
    writeFileSync(join(sidecarDir, 'i18n-quarantine-prefixes.json'), JSON.stringify(['legacy']));
    writeFileSync(
      join(sourceDir, 'page.tsx'),
      ["import { messages } from '@novelhub/shared';", 'messages.legacy.title;'].join('\n'),
    );

    const report = buildI18nKeyAuditReport({
      repoRoot,
      messages: { legacy: { title: 'Legacy', cta: 'Old' }, drama: { title: 'Drama' } },
    });

    expect(report.buckets.quarantinedReferenced).toEqual([
      {
        key: 'legacy.title',
        references: ['apps/web/src/page.tsx'],
        reason: 'matches quarantined prefix "legacy" but is still statically referenced',
      },
    ]);
    expect(report.buckets.quarantinedOnly).toEqual([
      { key: 'legacy.cta', reason: 'matches quarantined prefix "legacy"' },
    ]);
    expect(report.buckets.active).toEqual([]);
  });

  it('falls back to the hard-coded quarantine prefix list when the sidecar is missing', () => {
    const repoRoot = createTempRepo('novelhub-i18n-audit-fallback-');

    const report = buildI18nKeyAuditReport({
      repoRoot,
      messages: { watch: { title: 'Watch' }, video: { title: 'Video' } },
    });

    expect(report.buckets.quarantinedOnly).toEqual([
      { key: 'watch.title', reason: 'matches quarantined prefix "watch"' },
    ]);
    expect(report.buckets.active).toEqual([]);
    expect(report.buckets.quarantinedReferenced).toEqual([]);
  });

  it('keeps video, stream, and series out of the default sidecar when no en.json keys back them', () => {
    const repoRoot = createTempRepo('novelhub-i18n-audit-prefixes-');
    const sidecarDir = join(repoRoot, 'docs', 'pivot');
    mkdirSync(sidecarDir, { recursive: true });
    writeFileSync(
      join(sidecarDir, 'i18n-quarantine-prefixes.json'),
      JSON.stringify(['drama', 'dramas', 'episode', 'episodes', 'playback', 'watch'], null, 2),
    );

    const report = buildI18nKeyAuditReport({
      repoRoot,
      messages: {
        video: { title: 'Video' },
        stream: { title: 'Stream' },
        series: { title: 'Series' },
      },
    });

    expect(report.buckets.quarantinedOnly).toEqual([]);
    expect(report.limitations.join('\n')).toContain('Unreferenced non-quarantine message keys');
  });
});
