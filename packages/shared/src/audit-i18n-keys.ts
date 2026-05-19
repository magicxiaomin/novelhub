import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// schemaVersion 2 contract: replaces the original orphanStyle bucket with
// quarantinedReferenced so referenced quarantined keys stay visible.

export type I18nAuditBucketItem = {
  key: string;
  references?: string[];
  reason?: string;
};

export type I18nAuditReport = {
  schemaVersion: 2;
  generatedBy: 'scripts/audit-i18n-keys.ts';
  buckets: {
    active: I18nAuditBucketItem[];
    quarantinedOnly: I18nAuditBucketItem[];
    quarantinedReferenced: I18nAuditBucketItem[];
    missing: I18nAuditBucketItem[];
  };
  summary: {
    active: number;
    quarantinedOnly: number;
    quarantinedReferenced: number;
    missing: number;
  };
  limitations: string[];
};

type MessagesTree = Record<string, unknown>;

type BuildAuditOptions = {
  repoRoot: string;
  messages: MessagesTree;
  quarantinePrefixesPath?: string;
};

const SCAN_DIRS = ['apps', 'packages'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const FALLBACK_QUARANTINED_PREFIXES = [
  'drama',
  'dramas',
  'episode',
  'episodes',
  'playback',
  'watch',
];
const QUARANTINE_PREFIXES_SIDECAR = 'docs/pivot/i18n-quarantine-prefixes.json';
const MESSAGE_REFERENCE_RE = /\bmessages(?:Json)?((?:\.[A-Za-z_$][\w$]*)+)/g;
const TEST_FILE_RE = /(?:^|[\\/])[^\\/]+\.(?:spec|test)\.tsx?$/;

/**
 * Builds the report-only i18n key audit.
 *
 * schemaVersion 2 exposes stable bucket names: active, quarantinedOnly,
 * quarantinedReferenced, and missing. New fields may be added without a version bump, but
 * future bucket renames/removals require schemaVersion 3. quarantinedReferenced makes
 * quarantine-prefix keys visible when non-test, non-quarantined source files still reference
 * them; unreferenced non-quarantine message keys are intentionally outside the v2 report.
 *
 * Quarantine prefixes are read from docs/pivot/i18n-quarantine-prefixes.json when present,
 * falling back to drama, dramas, episode, episodes, playback, watch. The default sidecar
 * omits video, stream, and series because no packages/shared/src/messages/en.json keys exist
 * for those prefixes at ebb2ef4; add them when corresponding keys are introduced.
 */
export function buildI18nKeyAuditReport(options: BuildAuditOptions): I18nAuditReport {
  const repoRoot = resolve(options.repoRoot);
  const messageKeys = new Set(flattenLeafKeys(options.messages));
  const quarantinePrefixes = loadQuarantinePrefixes(repoRoot, options.quarantinePrefixesPath);
  const references = collectMessageReferences(repoRoot, messageKeys);

  const active = [...references.entries()]
    .filter(([key]) => messageKeys.has(key) && !isQuarantined(key, quarantinePrefixes))
    .map(([key, refs]) => ({ key, references: [...refs].sort() }))
    .sort(compareByKey);

  const quarantinedOnly = [...messageKeys]
    .filter((key) => isQuarantined(key, quarantinePrefixes) && !references.has(key))
    .map((key) => ({ key, reason: `matches quarantined prefix "${key.split('.')[0]}"` }))
    .sort(compareByKey);

  const quarantinedReferenced = [...references.entries()]
    .filter(([key]) => messageKeys.has(key) && isQuarantined(key, quarantinePrefixes))
    .map(([key, refs]) => ({
      key,
      references: [...refs].sort(),
      reason: `matches quarantined prefix "${key.split('.')[0]}" but is still statically referenced`,
    }))
    .sort(compareByKey);

  const missing = [...references.entries()]
    .filter(([key]) => !messageKeys.has(key))
    .map(([key, refs]) => ({ key, references: [...refs].sort() }))
    .sort(compareByKey);

  return {
    schemaVersion: 2,
    generatedBy: 'scripts/audit-i18n-keys.ts',
    buckets: { active, quarantinedOnly, quarantinedReferenced, missing },
    summary: {
      active: active.length,
      quarantinedOnly: quarantinedOnly.length,
      quarantinedReferenced: quarantinedReferenced.length,
      missing: missing.length,
    },
    limitations: [
      'Static heuristic only: dynamic message-key composition is not resolved.',
      'Report-only audit: findings do not imply automatic deletion or reactivation.',
      'Quarantine classification is prefix-based and intentionally conservative.',
      'Unreferenced non-quarantine message keys are intentionally outside schemaVersion 2 report buckets.',
    ],
  };
}

function loadQuarantinePrefixes(repoRoot: string, explicitPath?: string): string[] {
  const sidecarPath = explicitPath ?? resolve(repoRoot, QUARANTINE_PREFIXES_SIDECAR);
  if (!existsSync(sidecarPath)) {
    return FALLBACK_QUARANTINED_PREFIXES;
  }

  const parsed = JSON.parse(readFileSync(sidecarPath, 'utf8')) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item) => typeof item === 'string' && item.length > 0)
  ) {
    throw new Error(`${relative(repoRoot, sidecarPath)} must be a JSON array of non-empty strings`);
  }
  return parsed;
}

function collectMessageReferences(
  repoRoot: string,
  messageKeys: Set<string>,
): Map<string, Set<string>> {
  const references = new Map<string, Set<string>>();

  for (const dir of SCAN_DIRS) {
    const absoluteDir = resolve(repoRoot, dir);
    walkSourceFiles(absoluteDir, (filePath) => {
      if (
        filePath.endsWith('/messages/en.json') ||
        filePath.endsWith('\\messages\\en.json') ||
        TEST_FILE_RE.test(filePath)
      ) {
        return;
      }

      const source = readFileSync(filePath, 'utf8');
      if (!usesSharedMessages(source)) {
        return;
      }
      for (const key of extractMessageKeys(source, messageKeys)) {
        const relativePath = relative(repoRoot, filePath).replace(/\\/g, '/');
        const refs = references.get(key) ?? new Set<string>();
        refs.add(relativePath);
        references.set(key, refs);
      }
    });
  }

  return references;
}

function usesSharedMessages(source: string): boolean {
  return (
    /import\s+\{[^}]*\bmessages\b[^}]*\}\s+from\s+['"]@novelhub\/shared['"]/.test(source) ||
    /import\s+messagesJson\s+from\s+['"].*\/messages\/en\.json['"]/.test(source)
  );
}

function extractMessageKeys(source: string, messageKeys: Set<string>): string[] {
  const keys = new Set<string>();
  for (const match of source.matchAll(MESSAGE_REFERENCE_RE)) {
    const rawKey = (match[1] ?? '').split('.').filter(Boolean).join('.');
    const normalizedKey = normalizeMessageReference(rawKey, messageKeys);
    if (normalizedKey) {
      keys.add(normalizedKey);
    }
  }
  return [...keys];
}

function normalizeMessageReference(rawKey: string, messageKeys: Set<string>): string | null {
  if (messageKeys.has(rawKey)) {
    return rawKey;
  }

  const segments = rawKey.split('.');
  for (let length = segments.length - 1; length > 0; length -= 1) {
    const candidate = segments.slice(0, length).join('.');
    if (messageKeys.has(candidate)) {
      return candidate;
    }
  }

  const referencesExistingBranch = [...messageKeys].some((key) => key.startsWith(`${rawKey}.`));
  return referencesExistingBranch ? null : rawKey;
}

function walkSourceFiles(dir: string, visit: (filePath: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') {
      continue;
    }
    const fullPath = resolve(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkSourceFiles(fullPath, visit);
      continue;
    }
    if (stats.isFile() && SOURCE_EXTENSIONS.has(fileExtension(fullPath))) {
      visit(fullPath);
    }
  }
}

function flattenLeafKeys(value: unknown, prefix = ''): string[] {
  if (!isRecord(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenLeafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuarantined(key: string, quarantinePrefixes: string[]): boolean {
  const topLevelKey = key.split('.')[0] ?? '';
  return quarantinePrefixes.includes(topLevelKey);
}

function compareByKey(a: I18nAuditBucketItem, b: I18nAuditBucketItem): number {
  return a.key.localeCompare(b.key);
}

function fileExtension(filePath: string): string {
  const match = /\.[^.]+$/.exec(filePath);
  return match?.[0] ?? '';
}
