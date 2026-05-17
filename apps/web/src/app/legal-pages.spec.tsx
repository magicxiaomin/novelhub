import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { messages } from '@novelhub/shared';

const forbiddenDraftCopyPatterns = [
  /TODO:\s*legal\s*review/i,
  /messages\.legal\.todo/i,
  /legal\.todo/i,
  /pending\s+legal\s+review/i,
  /placeholder\s+(?:content|terms|refund policy|DMCA policy)/i,
];

const legalPageSources = ['privacy', 'terms', 'refund', 'dmca', 'contact', 'about'].map((route) =>
  readFileSync(join(process.cwd(), 'src/app', route, 'page.tsx'), 'utf8'),
);

describe('public legal pages', () => {
  it('renders no visible draft legal body copy from source', () => {
    const source = legalPageSources.join('\n');

    for (const pattern of forbiddenDraftCopyPatterns) {
      expect(source).not.toMatch(pattern);
    }
  });

  it('omits legal message body copy', () => {
    const legalMessageKeys = Object.keys(messages.legal);

    expect(legalMessageKeys).toEqual([
      'privacyTitle',
      'termsTitle',
      'refundTitle',
      'dmcaTitle',
      'contactTitle',
      'aboutTitle',
    ]);
  });
});
