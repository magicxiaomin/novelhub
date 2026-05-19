import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildI18nKeyAuditReport } from './audit-i18n-keys';

describe('buildI18nKeyAuditReport', () => {
  it('returns report-only active, quarantined-only, missing, and orphan-style buckets without mutating messages', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'novelhub-i18n-audit-'));
    const sourceDir = join(repoRoot, 'apps', 'web', 'src');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, 'page.tsx'),
      [
        "import { messages } from '@novelhub/shared';",
        "messages.nav.home.replaceAll('{name}', 'reader');",
        'messages.missing.copy;',
      ].join('\n'),
    );
    writeFileSync(
      join(sourceDir, 'page.spec.ts'),
      ["import { messages } from '@novelhub/shared';", 'messages.nav.library;'].join('\n'),
    );

    const messagesJson = {
      nav: { home: 'Home', library: 'Library' },
      drama: { title: 'Drama' },
    };
    const before = JSON.stringify(messagesJson);

    const report = buildI18nKeyAuditReport({ repoRoot, messages: messagesJson });

    expect(JSON.stringify(messagesJson)).toBe(before);
    expect(report.schemaVersion).toBe(1);
    expect(report.buckets.active).toEqual([
      { key: 'nav.home', references: ['apps/web/src/page.tsx'] },
    ]);
    expect(report.buckets.quarantinedOnly).toEqual([
      { key: 'drama.title', reason: 'matches quarantined prefix "drama"' },
    ]);
    expect(report.buckets.missing).toEqual([
      { key: 'missing.copy', references: ['apps/web/src/page.tsx'] },
    ]);
    expect(report.buckets.orphanStyle).toEqual([
      { key: 'nav.library', reason: 'message key has no static messages.* reference' },
    ]);
    expect(report.summary).toEqual({ active: 1, quarantinedOnly: 1, missing: 1, orphanStyle: 1 });
    expect(report.limitations).toContain(
      'Static heuristic only: dynamic message-key composition is not resolved.',
    );
  });
});
