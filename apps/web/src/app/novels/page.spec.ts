import { describe, expect, it } from 'vitest';

import { metadata } from './page';
import { messages } from '@novelhub/shared';

describe('novels page metadata', () => {
  it('keeps SEO and social previews focused on novels discovery', () => {
    expect(metadata.title).toBe(messages.metadata.novels.title);
    expect(metadata.description).toBe(messages.metadata.novels.description);
    expect(metadata.openGraph).toMatchObject({
      title: messages.metadata.novels.title,
      description: metadata.description,
      type: 'website',
      images: [{ url: '/og/novels.png', alt: messages.metadata.novels.ogAlt }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: messages.metadata.novels.title,
      description: metadata.description,
      images: ['/og/novels.png'],
    });
  });
});
