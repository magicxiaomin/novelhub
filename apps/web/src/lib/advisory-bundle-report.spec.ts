import { describe, expect, it } from 'vitest';

import { buildAdvisoryBundleReport } from './advisory-bundle-report';

const manifest = {
  pages: {
    '/': ['static/chunks/a.js', 'static/chunks/home.js'],
    '/book/[id]': ['static/chunks/a.js', 'static/chunks/book.js'],
  },
  app: {
    '/page': ['static/chunks/app-home.js'],
  },
};

const fileSizes = {
  'static/chunks/a.js': 1000,
  'static/chunks/home.js': 2000,
  'static/chunks/book.js': 3000,
  'static/chunks/app-home.js': 1500,
};

describe('buildAdvisoryBundleReport', () => {
  it('summarizes key route bundle bytes without enforcing thresholds', () => {
    const report = buildAdvisoryBundleReport({
      manifest,
      fileSizes,
      routes: ['/', '/book/[id]', '/page'],
      generatedAt: '2026-05-18T00:00:00.000Z',
    });

    expect(report).toContain('# Advisory bundle-size report');
    expect(report).toContain(
      'Advisory only: this report records bundle output and does not enforce CI thresholds.',
    );
    expect(report).toContain('| / | 2 | 2.9 KiB |');
    expect(report).toContain('| /book/[id] | 2 | 3.9 KiB |');
    expect(report).toContain('| /page | 1 | 1.5 KiB |');
  });
});
