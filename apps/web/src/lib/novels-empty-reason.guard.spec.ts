import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const webSrcDir = join(process.cwd(), 'src');
const guardedRelativeFiles = [
  'lib/novels-empty-reason.ts',
  'components/novels/novels-empty-reason-reporter.tsx',
  'components/novels/novels-empty-state.tsx',
  'app/novels/page.tsx',
] as const;

const forbiddenSourcePatterns: Array<[RegExp, string]> = [
  [/\bfetch\s*\(/, 'network fetch'],
  [/sendBeacon/, 'navigator.sendBeacon'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsessionStorage\b/, 'sessionStorage'],
  [/document\.cookie/, 'document.cookie'],
  [/@vercel\/analytics/, '@vercel/analytics'],
  [/@sentry\/nextjs|\bSentry\b/, 'Sentry'],
  [/fbq|Facebook Pixel|Meta Pixel|Pixel/, 'Pixel'],
  [/CAPI|Conversions API|FB_CAPI/, 'CAPI'],
  [/server-only/, 'server-only'],
  [/route\.ts|NextResponse|NextRequest/, 'route-handler'],
];

function readGuardedFile(relativePath: string): string {
  return readFileSync(join(webSrcDir, relativePath), 'utf8');
}

describe('novels empty reason source guard', () => {
  it('keeps the new reporter seam free of network, storage, server, and vendor analytics creep', () => {
    for (const relativePath of guardedRelativeFiles) {
      const source = readGuardedFile(relativePath);

      for (const [pattern, label] of forbiddenSourcePatterns) {
        expect(source, `${relativePath} must not contain ${label}`).not.toMatch(pattern);
      }
    }
  });

  it('keeps the route as an async Server Component and the empty state server-safe', () => {
    const pageSource = readGuardedFile('app/novels/page.tsx');
    const emptyStateSource = readGuardedFile('components/novels/novels-empty-state.tsx');
    const reporterSource = readGuardedFile('components/novels/novels-empty-reason-reporter.tsx');

    expect(pageSource).toContain('export default async function NovelsPage');
    expect(pageSource).not.toMatch(/^'use client';/);
    expect(emptyStateSource).not.toContain("'use client';");
    expect(emptyStateSource).not.toContain('useEffect');
    expect(emptyStateSource).not.toContain('onEmptyReason');
    expect(reporterSource).toMatch(/^'use client';/);
  });

  it('wires the reporter into only the novels empty branch with serializable boolean props', () => {
    const pageSource = readGuardedFile('app/novels/page.tsx');

    expect(pageSource).toContain('NovelsEmptyReasonReporter');
    expect(pageSource).toContain('hasCategoryFilter={hasCategoryFilter}');
    expect(pageSource).toContain('hasStatusFilter={hasStatusFilter}');
    expect(pageSource).not.toContain('onEmptyReason=');
    expect(pageSource).not.toContain('category={filters.category}');
    expect(pageSource).not.toContain('status={filters.status}');
  });
});
