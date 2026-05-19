import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COVERAGE_DOC_PATH = 'docs/pivot/novels-funnel-coverage.md';
const COVERING_SPEC_HEADER = 'covering spec path(s) or blocker';
const LOCAL_PATH_RE = /(?:^|[\s(`])([A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@[\]-]+)+)(?=$|[\s`),.;:])/g;
const CONCRETE_LOCAL_PATH_PREFIXES = ['apps/', 'packages/', 'tests/', 'docs/', 'scripts/'];

export type FunnelCoverageRow = {
  rowNumber: number;
  stage: string;
  paths: string[];
};

export type MissingFunnelCoveragePath = {
  rowNumber: number;
  stage: string;
  path: string;
};

export type FunnelCoverageParseResult = {
  rows: FunnelCoverageRow[];
};

export type FunnelCoverageAuditResult = FunnelCoverageParseResult & {
  ok: boolean;
  missingPaths: MissingFunnelCoveragePath[];
};

export type AuditFunnelCoverageOptions = {
  repoRoot: string;
  coveragePath?: string;
};

export function parseFunnelCoverageMarkdown(markdown: string): FunnelCoverageParseResult {
  const lines = markdown.split(/\r?\n/);
  const rows: FunnelCoverageRow[] = [];
  let foundExpectedTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const headerCells = parseTableRow(lines[index] ?? '');
    if (!headerCells) {
      continue;
    }

    const coveringSpecIndex = headerCells.findIndex(
      (cell) => normalizeCellText(cell) === COVERING_SPEC_HEADER,
    );
    if (coveringSpecIndex < 0) {
      continue;
    }

    const separatorCells = parseTableRow(lines[index + 1] ?? '');
    if (!separatorCells?.every(isSeparatorCell)) {
      throw new Error(`Malformed coverage table near line ${index + 1}: missing separator row`);
    }
    if (separatorCells.length !== headerCells.length) {
      throw new Error(
        `Malformed coverage table near line ${index + 1}: header/separator width mismatch`,
      );
    }

    foundExpectedTable = true;
    const stageIndex = headerCells.findIndex((cell) =>
      /^(funnel stage|route folder|worker route file)$/i.test(normalizeCellText(cell)),
    );
    if (stageIndex < 0) {
      throw new Error(
        `Malformed coverage table near line ${index + 1}: missing stage/path-label column`,
      );
    }

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const cells = parseTableRow(lines[rowIndex] ?? '');
      if (!cells) {
        break;
      }
      if (cells.length !== headerCells.length) {
        throw new Error(
          `Malformed coverage table row ${rowIndex + 1}: expected ${headerCells.length} cells, found ${cells.length}`,
        );
      }
      rows.push({
        rowNumber: rowIndex + 1,
        stage: stripInlineMarkdown(cells[stageIndex] ?? ''),
        paths: extractConcreteLocalPaths(cells[coveringSpecIndex] ?? ''),
      });
    }
  }

  if (!foundExpectedTable) {
    throw new Error(
      'Expected at least one markdown table with a "Covering spec path(s) or blocker" column',
    );
  }

  return { rows };
}

export function auditFunnelCoverage(
  options: AuditFunnelCoverageOptions,
): FunnelCoverageAuditResult {
  const repoRoot = resolve(options.repoRoot);
  const coveragePath = options.coveragePath ?? resolve(repoRoot, COVERAGE_DOC_PATH);
  const parsed = parseFunnelCoverageMarkdown(readFileSync(coveragePath, 'utf8'));
  const missingPaths = parsed.rows.flatMap((row) =>
    row.paths
      .filter((path) => !existsSync(resolve(repoRoot, path)))
      .map((path) => ({ rowNumber: row.rowNumber, stage: row.stage, path })),
  );

  return {
    ok: missingPaths.length === 0,
    rows: parsed.rows,
    missingPaths,
  };
}

export function formatFunnelCoverageAudit(result: FunnelCoverageAuditResult): string {
  const parsedLines = result.rows.flatMap((row) =>
    row.paths.map((path) => `row ${row.rowNumber} | ${row.stage} | ${path}`),
  );
  if (result.ok) {
    return [`OK: ${parsedLines.length} concrete coverage path(s) verified.`, ...parsedLines].join(
      '\n',
    );
  }
  return [
    `FAIL: ${result.missingPaths.length} parsed concrete coverage path(s) are missing.`,
    ...result.missingPaths.map((item) => `row ${item.rowNumber} | ${item.stage} | ${item.path}`),
  ].join('\n');
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function extractConcreteLocalPaths(cell: string): string[] {
  const paths = new Set<string>();
  for (const match of cell.matchAll(LOCAL_PATH_RE)) {
    const path = match[1] ?? '';
    if (isConcreteLocalPath(path)) {
      paths.add(path);
    }
  }
  return [...paths];
}

function isConcreteLocalPath(path: string): boolean {
  return (
    CONCRETE_LOCAL_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
    !path.includes('*') &&
    !path.endsWith('/') &&
    !path.includes('..')
  );
}

function normalizeCellText(cell: string): string {
  return stripInlineMarkdown(cell).toLowerCase().replace(/\s+/g, ' ').trim();
}

function stripInlineMarkdown(value: string): string {
  return value.replace(/`/g, '').trim();
}
