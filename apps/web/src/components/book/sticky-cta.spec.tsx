import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StickyStartReadingContent } from './sticky-cta';

describe('StickyStartReadingContent', () => {
  it('renders the unchanged start CTA when no resume progress exists', () => {
    const html = renderToStaticMarkup(
      <StickyStartReadingContent
        bookId="book-1"
        chapterNumber={1}
        label="Start Reading"
        offset="bottom-0"
      />,
    );

    expect(html).toContain('Start Reading');
    expect(html).toContain('href="/read/book-1/1"');
  });

  it('renders an anonymous resume CTA for the stored chapter', () => {
    const html = renderToStaticMarkup(
      <StickyStartReadingContent
        bookId="book with spaces"
        chapterNumber={7}
        label="Resume Chapter 7"
        offset="bottom-0"
      />,
    );

    expect(html).toContain('Resume Chapter 7');
    expect(html).toContain('href="/read/book%20with%20spaces/7"');
  });
});
