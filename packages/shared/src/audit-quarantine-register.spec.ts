import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  auditQuarantineRegister,
  parseQuarantineRegisterMarkdown,
} from './audit-quarantine-register';

describe('parseQuarantineRegisterMarkdown', () => {
  it('parses sections, rows, dispositions, and concrete cited paths', () => {
    const markdown = [
      '# Register',
      '',
      '## Web routes and UI',
      '',
      '| Artifact | Disposition | Rationale / follow-up note |',
      '| --- | --- | --- |',
      '| `apps/web/src/app/dramas/page.tsx` route | gate | Gate direct URL. |',
      '| Drama strings in `packages/shared/src/messages/en.json` | hide | Hide active copy. |',
    ].join('\n');

    expect(parseQuarantineRegisterMarkdown(markdown)).toEqual({
      rows: [
        {
          rowNumber: 7,
          section: 'Web routes and UI',
          artifact: '`apps/web/src/app/dramas/page.tsx` route',
          disposition: 'gate',
          paths: ['apps/web/src/app/dramas/page.tsx'],
        },
        {
          rowNumber: 8,
          section: 'Web routes and UI',
          artifact: 'Drama strings in `packages/shared/src/messages/en.json`',
          disposition: 'hide',
          paths: ['packages/shared/src/messages/en.json'],
        },
      ],
    });
  });

  it('rejects invalid disposition values', () => {
    const markdown = [
      '## Web routes and UI',
      '| Artifact | Disposition | Rationale / follow-up note |',
      '| --- | --- | --- |',
      '| `apps/web/src/app/dramas/page.tsx` | delete | no |',
    ].join('\n');

    expect(() => parseQuarantineRegisterMarkdown(markdown)).toThrow(
      'Invalid quarantine disposition "delete" on row 4',
    );
  });

  it('rejects malformed table rows and duplicate artifact rows', () => {
    expect(() =>
      parseQuarantineRegisterMarkdown(
        [
          '## Web routes and UI',
          '| Artifact | Disposition | Rationale / follow-up note |',
          '| --- | --- | --- |',
          '| `apps/web/src/app/dramas/page.tsx` | gate |',
        ].join('\n'),
      ),
    ).toThrow('Malformed quarantine table row 4: expected 3 cells, found 2');

    expect(() =>
      parseQuarantineRegisterMarkdown(
        [
          '## Web routes and UI',
          '| Artifact | Disposition | Rationale / follow-up note |',
          '| --- | --- | --- |',
          '| `apps/web/src/app/dramas/page.tsx` | gate | first |',
          '| `apps/web/src/app/dramas/page.tsx` | retain | duplicate |',
        ].join('\n'),
      ),
    ).toThrow('Duplicate quarantine artifact row "`apps/web/src/app/dramas/page.tsx`" on row 5');
  });
});

describe('auditQuarantineRegister', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createTempRepo = (): string => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'novelhub-quarantine-register-'));
    tempDirs.push(repoRoot);
    mkdirSync(join(repoRoot, 'docs', 'pivot'), { recursive: true });
    return repoRoot;
  };

  it('fails when removed rows cite concrete local files that have reappeared', () => {
    const repoRoot = createTempRepo();
    mkdirSync(join(repoRoot, 'packages', 'shared', 'src'), { recursive: true });
    writeFileSync(join(repoRoot, 'packages', 'shared', 'src', 'drama-e2e-fixtures.ts'), 'oops');
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'quarantine-register.md'),
      [
        '## Tests, scripts, and fixtures',
        '| Artifact | Disposition | Rationale / follow-up note |',
        '| --- | --- | --- |',
        '| `packages/shared/src/drama-e2e-fixtures.ts` | removed | Removed by #218. |',
      ].join('\n'),
    );

    expect(auditQuarantineRegister({ repoRoot })).toEqual({
      ok: false,
      rows: [
        {
          rowNumber: 4,
          section: 'Tests, scripts, and fixtures',
          artifact: '`packages/shared/src/drama-e2e-fixtures.ts`',
          disposition: 'removed',
          paths: ['packages/shared/src/drama-e2e-fixtures.ts'],
        },
      ],
      failures: [
        {
          rowNumber: 4,
          section: 'Tests, scripts, and fixtures',
          artifact: '`packages/shared/src/drama-e2e-fixtures.ts`',
          path: 'packages/shared/src/drama-e2e-fixtures.ts',
          reason: 'removed-path-reappeared',
        },
      ],
      warnings: [],
    });
  });

  it('passes for present non-removed quarantined paths that are not imported elsewhere', () => {
    const repoRoot = createTempRepo();
    mkdirSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'dramas'), { recursive: true });
    mkdirSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'novels'), { recursive: true });
    writeFileSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'dramas', 'page.tsx'), 'export {}');
    writeFileSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'novels', 'page.tsx'), 'export {}');
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'quarantine-register.md'),
      [
        '## Web routes and UI',
        '| Artifact | Disposition | Rationale / follow-up note |',
        '| --- | --- | --- |',
        '| `apps/web/src/app/dramas/page.tsx` | gate | Gate route. |',
      ].join('\n'),
    );

    expect(auditQuarantineRegister({ repoRoot })).toEqual({
      ok: true,
      rows: [
        {
          rowNumber: 4,
          section: 'Web routes and UI',
          artifact: '`apps/web/src/app/dramas/page.tsx`',
          disposition: 'gate',
          paths: ['apps/web/src/app/dramas/page.tsx'],
        },
      ],
      failures: [],
      warnings: [],
    });
  });

  it('fails when non-quarantined sources import present non-removed quarantined paths', () => {
    const repoRoot = createTempRepo();
    mkdirSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'dramas'), { recursive: true });
    mkdirSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'novels'), { recursive: true });
    writeFileSync(join(repoRoot, 'apps', 'web', 'src', 'app', 'dramas', 'page.tsx'), 'export {}');
    writeFileSync(
      join(repoRoot, 'apps', 'web', 'src', 'app', 'novels', 'page.tsx'),
      "import DramaPage from 'apps/web/src/app/dramas/page.tsx';\nexport default DramaPage;",
    );
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'quarantine-register.md'),
      [
        '## Web routes and UI',
        '| Artifact | Disposition | Rationale / follow-up note |',
        '| --- | --- | --- |',
        '| `apps/web/src/app/dramas/page.tsx` | gate | Gate route. |',
      ].join('\n'),
    );

    expect(auditQuarantineRegister({ repoRoot })).toEqual({
      ok: false,
      rows: [
        {
          rowNumber: 4,
          section: 'Web routes and UI',
          artifact: '`apps/web/src/app/dramas/page.tsx`',
          disposition: 'gate',
          paths: ['apps/web/src/app/dramas/page.tsx'],
        },
      ],
      failures: [
        {
          rowNumber: 4,
          section: 'Web routes and UI',
          artifact: '`apps/web/src/app/dramas/page.tsx`',
          path: 'apps/web/src/app/dramas/page.tsx',
          reason: 'non-removed-path-imported',
          sourcePath: 'apps/web/src/app/novels/page.tsx',
        },
      ],
      warnings: [],
    });
  });

  it('warns without failing for absent non-removed cited paths, citation-less rows, and absent removed rows', () => {
    const repoRoot = createTempRepo();
    writeFileSync(
      join(repoRoot, 'docs', 'pivot', 'quarantine-register.md'),
      [
        '## Web routes and UI',
        '| Artifact | Disposition | Rationale / follow-up note |',
        '| --- | --- | --- |',
        '| `apps/web/src/app/dramas/page.tsx` | gate | Gate route. |',
        '| HLS URLs and poster URLs in drama fixtures | retain | External media only. |',
        '| `tests/e2e/specs/drama-regression.spec.ts` | removed | Removed. |',
      ].join('\n'),
    );

    expect(auditQuarantineRegister({ repoRoot })).toEqual({
      ok: true,
      rows: [
        {
          rowNumber: 4,
          section: 'Web routes and UI',
          artifact: '`apps/web/src/app/dramas/page.tsx`',
          disposition: 'gate',
          paths: ['apps/web/src/app/dramas/page.tsx'],
        },
        {
          rowNumber: 5,
          section: 'Web routes and UI',
          artifact: 'HLS URLs and poster URLs in drama fixtures',
          disposition: 'retain',
          paths: [],
        },
        {
          rowNumber: 6,
          section: 'Web routes and UI',
          artifact: '`tests/e2e/specs/drama-regression.spec.ts`',
          disposition: 'removed',
          paths: ['tests/e2e/specs/drama-regression.spec.ts'],
        },
      ],
      failures: [],
      warnings: [
        {
          rowNumber: 4,
          section: 'Web routes and UI',
          artifact: '`apps/web/src/app/dramas/page.tsx`',
          path: 'apps/web/src/app/dramas/page.tsx',
          reason: 'non-removed-path-absent',
        },
        {
          rowNumber: 5,
          section: 'Web routes and UI',
          artifact: 'HLS URLs and poster URLs in drama fixtures',
          reason: 'no-local-path-citation',
        },
      ],
    });
  });
});
