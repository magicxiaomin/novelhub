import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import messagesJson from '../packages/shared/src/messages/en.json';
import { buildI18nKeyAuditReport } from '../packages/shared/src/audit-i18n-keys';

const repoRoot = process.cwd();
const baselinePath = resolve(repoRoot, 'packages/shared/src/audit-i18n-keys.baseline.json');

if (!existsSync(baselinePath)) {
  process.stderr.write(`Missing baseline: ${relative(repoRoot, baselinePath)}\n`);
  process.exit(1);
}

const actual = ensureTrailingNewline(
  JSON.stringify(buildI18nKeyAuditReport({ repoRoot, messages: messagesJson }), null, 2),
);
const expected = ensureTrailingNewline(readFileSync(baselinePath, 'utf8'));

if (actual === expected) {
  process.exit(0);
}

process.stdout.write(
  createUnifiedDiff(relative(repoRoot, baselinePath), 'current audit:i18n', expected, actual),
);
process.exit(1);

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function createUnifiedDiff(
  fromFile: string,
  toFile: string,
  expected: string,
  actual: string,
): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const lines = [`--- ${fromFile}`, `+++ ${toFile}`, '@@'];
  const maxLength = Math.max(expectedLines.length, actualLines.length);

  for (let index = 0; index < maxLength; index += 1) {
    const expectedLine = expectedLines[index];
    const actualLine = actualLines[index];
    if (expectedLine === actualLine) {
      if (expectedLine !== undefined && expectedLine !== '') {
        lines.push(` ${expectedLine}`);
      }
      continue;
    }
    if (expectedLine !== undefined && expectedLine !== '') {
      lines.push(`-${expectedLine}`);
    }
    if (actualLine !== undefined && actualLine !== '') {
      lines.push(`+${actualLine}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
