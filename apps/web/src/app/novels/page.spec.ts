import { describe, expect, it } from 'vitest';

import { metadata } from './page';

describe('novels page metadata', () => {
  it('keeps SEO and social previews focused on novels discovery', () => {
    expect(metadata.title).toBe('Browse Web Novels — NovelHub');
    expect(metadata.description).toContain('Browse serialized web novels');
    expect(metadata.openGraph).toMatchObject({
      title: 'Browse Web Novels — NovelHub',
      description: metadata.description,
      type: 'website',
      images: [{ url: '/og/novels.png', alt: 'Browse NovelHub web novels' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Browse Web Novels — NovelHub',
      description: metadata.description,
      images: ['/og/novels.png'],
    });
  });
});
