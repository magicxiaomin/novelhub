import { describe, expect, it } from 'vitest';

import { metadata } from './page';

describe('home page metadata', () => {
  it('keeps the novels-first SEO title, description, and social card', () => {
    expect(metadata.title).toBe('NovelHub — Read Addictive Web Novels');
    expect(metadata.description).toContain('serialized web novels');
    expect(metadata.openGraph).toMatchObject({
      title: 'NovelHub — Read Addictive Web Novels',
      description: metadata.description,
      type: 'website',
      images: [{ url: '/og/novelhub-home.png', alt: 'NovelHub web novels' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'NovelHub — Read Addictive Web Novels',
      description: metadata.description,
      images: ['/og/novelhub-home.png'],
    });
  });
});
