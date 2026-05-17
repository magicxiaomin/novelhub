import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ChapterList } from './chapter-list';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isFetching: false }),
}));

describe('ChapterList empty state', () => {
  it('renders a localized empty state instead of an empty bordered list when no chapters are available', () => {
    const html = renderToStaticMarkup(
      <ChapterList bookId="book-1" chapters={[]} totalChapters={0} />,
    );

    expect(html).toContain('No chapters available yet');
    expect(html).toContain('Check back soon for the first chapter.');
    expect(html).not.toContain('<ol');
    expect(html).not.toContain('href="/read/book-1/');
  });
});
