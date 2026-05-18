import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '..');

const auditedImageFiles = [
  'src/components/book/book-card.tsx',
  'src/components/home/featured-carousel.tsx',
  'src/components/home/continue-reading-rail.tsx',
  'src/app/book/[id]/page.tsx',
  'src/app/me/me-client.tsx',
];

type ImageAuditResult = {
  file: string;
  index: number;
  source: string;
  hasAlt: boolean;
  hasSizes: boolean;
  hasFill: boolean;
  hasWidth: boolean;
  hasHeight: boolean;
  hasExplicitLoadingOrPriority: boolean;
};

const imageTagPattern = /<Image\b[\s\S]*?\/>/g;

function auditNextImageTags(): ImageAuditResult[] {
  return auditedImageFiles.flatMap((file) => {
    const absolute = resolve(projectRoot, file);
    const source = readFileSync(absolute, 'utf8');
    const tags = source.match(imageTagPattern) ?? [];

    return tags.map((tag, index) => ({
      file: relative(projectRoot, absolute),
      index,
      source: tag,
      hasAlt: /\balt=/.test(tag),
      hasSizes: /\bsizes=/.test(tag),
      hasFill: /\bfill\b/.test(tag),
      hasWidth: /\bwidth=/.test(tag),
      hasHeight: /\bheight=/.test(tag),
      hasExplicitLoadingOrPriority: /\bloading=|\bpriority\b/.test(tag),
    }));
  });
}

describe('key web images', () => {
  it('have advisory performance attributes for book and account surfaces', () => {
    const images = auditNextImageTags();

    expect(images.length).toBeGreaterThan(0);
    expect(
      images.filter((image) => !image.hasAlt).map((image) => `${image.file}#${image.index}`),
    ).toEqual([]);
    expect(
      images
        .filter((image) => !(image.hasFill || (image.hasWidth && image.hasHeight)))
        .map((image) => `${image.file}#${image.index}`),
    ).toEqual([]);
    expect(
      images.filter((image) => !image.hasSizes).map((image) => `${image.file}#${image.index}`),
    ).toEqual([]);
    expect(
      images
        .filter((image) => !image.hasExplicitLoadingOrPriority)
        .map((image) => `${image.file}#${image.index}`),
    ).toEqual([]);
  });
});
