import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const QUARANTINE_REGISTER_PATH = 'docs/pivot/quarantine-register.md';
const VALID_DISPOSITIONS = ['retain', 'hide', 'gate', 'propose-later', 'removed'] as const;
const LOCAL_PATH_RE = /(?:^|[\s(`])([A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@[\]-]+)+)(?=$|[\s`),.;:])/g;
const CONCRETE_LOCAL_PATH_PREFIXES = ['apps/', 'packages/', 'tests/', 'docs/', 'scripts/'];

type QuarantineDisposition = (typeof VALID_DISPOSITIONS)[number];

export type QuarantineRegisterRow = {
  rowNumber: number;
  section: string;
  artifact: string;
  disposition: QuarantineDisposition;
  paths: string[];
};

export type QuarantineRegisterParseResult = {
  rows: QuarantineRegisterRow[];
};

export type QuarantineRegisterIssue = {
  rowNumber: number;
  section: string;
  artifact: string;
  reason: 'removed-path-reappeared' | 'non-removed-path-absent' | 'no-local-path-citation';
  path?: string;
};

export type QuarantineRegisterAuditResult = QuarantineRegisterParseResult & {
  ok: boolean;
  failures: QuarantineRegisterIssue[];
  warnings: QuarantineRegisterIssue[];
};

export type AuditQuarantineRegisterOptions = {
  repoRoot: string;
  registerPath?: string;
};

export function parseQuarantineRegisterMarkdown(markdown: string): QuarantineRegisterParseResult {
  const lines = markdown.split(/\r?\n/);
  const rows: QuarantineRegisterRow[] = [];
  const seenArtifacts = new Map<string, number>();
  let currentSection = '';
  let foundRegisterTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const sectionMatch = /^##\s+(.+?)\s*$/.exec(line.trim());
    if (sectionMatch) {
      currentSection = sectionMatch[1] ?? '';
      continue;
    }

    const headerCells = parseTableRow(line);
    if (!headerCells) {
      continue;
    }

    const artifactIndex = findNormalizedCellIndex(headerCells, 'artifact');
    const dispositionIndex = findNormalizedCellIndex(headerCells, 'disposition');
    if (artifactIndex < 0 && dispositionIndex < 0) {
      continue;
    }
    if (artifactIndex < 0 || dispositionIndex < 0) {
      throw new Error(
        `Malformed quarantine table near line ${index + 1}: missing artifact/disposition column`,
      );
    }

    const separatorCells = parseTableRow(lines[index + 1] ?? '');
    if (!separatorCells?.every(isSeparatorCell)) {
      throw new Error(`Malformed quarantine table near line ${index + 1}: missing separator row`);
    }
    if (separatorCells.length !== headerCells.length) {
      throw new Error(
        `Malformed quarantine table near line ${index + 1}: header/separator width mismatch`,
      );
    }

    foundRegisterTable = true;
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const cells = parseTableRow(lines[rowIndex] ?? '');
      if (!cells) {
        break;
      }
      if (cells.length !== headerCells.length) {
        throw new Error(
          `Malformed quarantine table row ${rowIndex + 1}: expected ${headerCells.length} cells, found ${cells.length}`,
        );
      }

      const artifact = cells[artifactIndex] ?? '';
      const dispositionText = normalizeCellText(cells[dispositionIndex] ?? '');
      if (!isQuarantineDisposition(dispositionText)) {
        throw new Error(
          `Invalid quarantine disposition "${dispositionText}" on row ${rowIndex + 1}`,
        );
      }

      const normalizedArtifact = normalizeCellText(artifact);
      const priorRowNumber = seenArtifacts.get(normalizedArtifact);
      if (priorRowNumber !== undefined) {
        throw new Error(
          `Duplicate quarantine artifact row "${artifact}" on row ${rowIndex + 1} (first seen on row ${priorRowNumber})`,
        );
      }
      seenArtifacts.set(normalizedArtifact, rowIndex + 1);

      rows.push({
        rowNumber: rowIndex + 1,
        section: currentSection,
        artifact,
        disposition: dispositionText,
        paths: extractConcreteLocalPaths(artifact),
      });
    }
  }

  if (!foundRegisterTable) {
    throw new Error('Expected at least one markdown table with Artifact and Disposition columns');
  }

  return { rows };
}

export function auditQuarantineRegister(
  options: AuditQuarantineRegisterOptions,
): QuarantineRegisterAuditResult {
  const repoRoot = resolve(options.repoRoot);
  const registerPath = options.registerPath ?? resolve(repoRoot, QUARANTINE_REGISTER_PATH);
  const parsed = parseQuarantineRegisterMarkdown(readFileSync(registerPath, 'utf8'));
  const failures: QuarantineRegisterIssue[] = [];
  const warnings: QuarantineRegisterIssue[] = [];

  for (const row of parsed.rows) {
    if (row.paths.length === 0) {
      warnings.push(toIssue(row, 'no-local-path-citation'));
      continue;
    }
    for (const path of row.paths) {
      const exists = existsSync(resolve(repoRoot, path));
      if (row.disposition === 'removed' && exists && isWholeArtifactPath(row.artifact, path)) {
        failures.push(toIssue(row, 'removed-path-reappeared', path));
      } else if (row.disposition !== 'removed' && !exists) {
        warnings.push(toIssue(row, 'non-removed-path-absent', path));
      }
    }
  }

  return { ok: failures.length === 0, rows: parsed.rows, failures, warnings };
}

export function formatQuarantineRegisterAudit(result: QuarantineRegisterAuditResult): string {
  const lines = [
    `${result.ok ? 'OK' : 'FAIL'}: parsed ${result.rows.length} quarantine register row(s).`,
  ];
  if (result.failures.length > 0) {
    lines.push('Failures:');
    lines.push(...result.failures.map(formatIssue));
  }
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push(...result.warnings.map(formatIssue));
  }
  return lines.join('\n');
}

function toIssue(
  row: QuarantineRegisterRow,
  reason: QuarantineRegisterIssue['reason'],
  path?: string,
): QuarantineRegisterIssue {
  return { rowNumber: row.rowNumber, section: row.section, artifact: row.artifact, path, reason };
}

function formatIssue(issue: QuarantineRegisterIssue): string {
  const pathPart = issue.path ? ` | ${issue.path}` : '';
  return `row ${issue.rowNumber} | ${issue.section} | ${issue.reason}${pathPart}`;
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

function findNormalizedCellIndex(cells: string[], expected: string): number {
  return cells.findIndex((cell) => normalizeCellText(cell) === expected);
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

function isWholeArtifactPath(artifact: string, path: string): boolean {
  return stripInlineMarkdown(artifact) === path;
}

function normalizeCellText(cell: string): string {
  return stripInlineMarkdown(cell).toLowerCase().replace(/\s+/g, ' ').trim();
}

function stripInlineMarkdown(value: string): string {
  return value.replace(/`/g, '').trim();
}

function isQuarantineDisposition(value: string): value is QuarantineDisposition {
  return VALID_DISPOSITIONS.includes(value as QuarantineDisposition);
}
