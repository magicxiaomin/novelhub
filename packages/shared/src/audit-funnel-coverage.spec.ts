import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { auditFunnelCoverage, parseFunnelCoverageMarkdown } from './audit-funnel-coverage';

describe('parseFunnelCoverageMarkdown', () => {
  it('parses concrete local spec/doc path citations from covering-spec cells', () => {
    const markdown = [
      '# Coverage',
      '',
      '| Funnel stage | Surface | Covering spec path(s) or blocker |',
      '| --- | --- | --- |',
      '| Ad landing | Home | `apps/web/src/app/page.spec.ts`, `tests/e2e/specs/novel-funnel.spec.ts` |',
      '| Novel detail | Detail | `apps/web/src/app/book/[id]/page.spec.ts`; see `docs/pivot/funnel.md` |',
    ].join('\n');

    expect(parseFunnelCoverageMarkdown(markdown)).toEqual({
      rows: [
        {
          rowNumber: 5,
          stage: 'Ad landing',
          paths: ['apps/web/src/app/page.spec.ts', 'tests/e2e/specs/novel-funnel.spec.ts'],
        },
        {
          rowNumber: 6,
          stage: 'Novel detail',
          paths: ['apps/web/src/app/book/[id]/page.spec.ts', 'docs/pivot/funnel.md'],
        },
      ],
    });
  });

  it('excludes wildcards, headings, blocker prose, route labels, and code fences outside the table', () => {
    const markdown = [
      '# `docs/pivot/funnel.md` heading outside table',
      '',
      '```',
      '`apps/web/src/app/page.spec.ts`',
      '```',
      '',
      '| Route folder | Covering spec path(s) or blocker |',
      '| --- | --- |',
      '| `apps/web/src/app/*` | `apps/web/src/app/*.spec.ts`, none — blocked on #233 / Kanban `t_030c3f29`; route label `/book/[id]`; `apps/web/src/app/page.spec.ts` |',
    ].join('\n');

    expect(parseFunnelCoverageMarkdown(markdown)).toEqual({
      rows: [
        {
          rowNumber: 9,
          stage: 'apps/web/src/app/*',
          paths: ['apps/web/src/app/page.spec.ts'],
        },
      ],
    });
  });

  it('rejects malformed expected coverage tables', () => {
    const markdown = [
      '| Funnel stage | Surface | Notes |',
      '| --- | --- | --- |',
      '| Ad landing | Home | `apps/web/src/app/page.spec.ts` |',
    ].join('\n');

    expect(() => parseFunnelCoverageMarkdown(markdown)).toThrow(
      'Expected at least one markdown table with a "Covering spec path(s) or blocker" column',
    );
  });
});

describe('auditFunnelCoverage', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createTempRepo = (): string => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'novelhub-funnel-coverage-'));
    tempDirs.push(repoRoot);
    mkdirSync(join(repoRoot, 'docs', 'pivot'), { recursive: true });
    return repoRoot;
  };

  it('passes when every parsed concrete path exists', () => {
    const repoRoot = createTempRepo();
    mkdirSync(join(repoRoot, 'apps', 'web', 'src', 'app'), { recursive: true });
    mkdirSync(join(repoRoot, 'docs', 'pivot'), { recursive: true });
    writeFileSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'page.spec.ts'), 'test');
    writeFileSync(join(repoRoot, 'docs', 'pivot', 'funnel.md'), 'doc');
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'novels-funnel-coverage.md'),
      [
        '| Funnel stage | Surface | Covering spec path(s) or blocker |',
        '| --- | --- | --- |',
        '| Ad landing | Home | `apps/web/src/app/page.spec.ts`, `docs/pivot/funnel.md` |',
        '',
        '| Surface | Coverage or status |',
        '| --- | --- |',
        '| External launch verification | none — blocked on #233 / Kanban `t_030c3f29`. |',
        '| Consent banner | blocked on #418 — pure-logic `packages/shared/src/consent.spec.ts` only. |',
      ].join('\n'),
    );

    expect(auditFunnelCoverage({ repoRoot }).ok).toBe(true);
  });

  it('reports row, stage, and path for missing parsed concrete paths', () => {
    const repoRoot = createTempRepo();
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'novels-funnel-coverage.md'),
      [
        '| Funnel stage | Surface | Covering spec path(s) or blocker |',
        '| --- | --- | --- |',
        '| Paywall | Locked | `apps/web/src/components/paywall/paywall.spec.tsx` |',
      ].join('\n'),
    );

    expect(auditFunnelCoverage({ repoRoot })).toEqual({
      ok: false,
      rows: [
        {
          rowNumber: 3,
          stage: 'Paywall',
          paths: ['apps/web/src/components/paywall/paywall.spec.tsx'],
        },
      ],
      missingPaths: [
        {
          rowNumber: 3,
          stage: 'Paywall',
          path: 'apps/web/src/components/paywall/paywall.spec.tsx',
        },
      ],
      blockerIssues: [
        {
          blocker: '#233',
          rowLabel: 'External launch verification',
          reason: 'missing blocker row',
        },
        {
          blocker: '#418',
          rowLabel: 'Consent banner',
          reason: 'missing blocker row',
        },
      ],
    });
  });

  it('fails synthetic fixtures when required blocker rows remove #233 or #418', () => {
    const repoRoot = createTempRepo();
    writeFileSync(join(repoRoot, 'docs', 'pivot', 'funnel.md'), 'doc');
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'novels-funnel-coverage.md'),
      [
        '| Funnel stage | Surface | Covering spec path(s) or blocker |',
        '| --- | --- | --- |',
        '| Ad landing | Home | `docs/pivot/funnel.md` |',
        '',
        '| Surface | Coverage or status |',
        '| --- | --- |',
        '| External launch verification | none — blocked on Kanban `t_030c3f29`. |',
        '| Consent banner | blocked on Kanban `t_f06112fb`. |',
      ].join('\n'),
    );

    expect(auditFunnelCoverage({ repoRoot })).toMatchObject({
      ok: false,
      blockerIssues: [
        {
          blocker: '#233',
          rowNumber: 7,
          rowLabel: 'External launch verification',
          reason: 'missing required open blocker reference',
        },
        {
          blocker: '#418',
          rowNumber: 8,
          rowLabel: 'Consent banner',
          reason: 'missing required open blocker reference',
        },
      ],
    });
  });

  it('fails synthetic fixtures when required blocker rows reword #233 or #418 as resolved', () => {
    const repoRoot = createTempRepo();
    writeFileSync(join(repoRoot, 'docs', 'pivot', 'funnel.md'), 'doc');
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'novels-funnel-coverage.md'),
      [
        '| Funnel stage | Surface | Covering spec path(s) or blocker |',
        '| --- | --- | --- |',
        '| Ad landing | Home | `docs/pivot/funnel.md` |',
        '',
        '| Surface | Coverage or status |',
        '| --- | --- |',
        '| External launch verification | #233 resolved by launch checklist coverage. |',
        '| Consent banner | #418 is closed; covered by `packages/shared/src/consent.spec.ts`. |',
      ].join('\n'),
    );

    expect(auditFunnelCoverage({ repoRoot })).toMatchObject({
      ok: false,
      blockerIssues: [
        {
          blocker: '#233',
          rowNumber: 7,
          rowLabel: 'External launch verification',
          reason: 'blocker row marks required blocker as resolved',
        },
        {
          blocker: '#418',
          rowNumber: 8,
          rowLabel: 'Consent banner',
          reason: 'blocker row marks required blocker as resolved',
        },
      ],
    });
  });
});
