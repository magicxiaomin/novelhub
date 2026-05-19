import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { messages } from '@novelhub/shared';
import { ReaderBottomBar } from './bottom-bar';

vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <svg aria-hidden="true" data-icon="chevron-left" />,
  ChevronRight: () => <svg aria-hidden="true" data-icon="chevron-right" />,
  List: () => <svg aria-hidden="true" data-icon="list" />,
  Settings: () => <svg aria-hidden="true" data-icon="settings" />,
}));
vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' '),
}));

vi.stubGlobal('React', React);

const renderBottomBar = (props?: Partial<React.ComponentProps<typeof ReaderBottomBar>>): string =>
  renderToStaticMarkup(
    <ReaderBottomBar
      visible
      prevHref="/read/book-1/1"
      nextHref="/read/book-1/3"
      onChapters={() => undefined}
      onSettings={() => undefined}
      {...props}
    />,
  );

describe('ReaderBottomBar rendering contract', () => {
  it('renders previous, chapters, settings, and next controls with localized aria labels', () => {
    const html = renderBottomBar();

    expect(html).toContain(`aria-label="${messages.reader.chapters}"`);
    expect(html).toContain(`aria-label="${messages.reader.previousChapter}"`);
    expect(html).toContain(`aria-label="${messages.reader.settings}"`);
    expect(html).toContain(`aria-label="${messages.reader.nextChapter}"`);
    expect(html).toContain('data-icon="chevron-left"');
    expect(html).toContain('data-icon="list"');
    expect(html).toContain('data-icon="settings"');
    expect(html).toContain('data-icon="chevron-right"');
  });

  it('renders previous and next controls as navigable links when hrefs are present', () => {
    const html = renderBottomBar({
      prevHref: '/read/book-1/1',
      nextHref: '/read/book-1/3',
    });

    expect(html).toContain('href="/read/book-1/1"');
    expect(html).toContain('href="/read/book-1/3"');
    expect(html).toContain('<a href="/read/book-1/1"');
    expect(html).toContain('<a href="/read/book-1/3"');
  });

  it('renders previous and next controls as disabled non-link placeholders when hrefs are absent', () => {
    const html = renderBottomBar({
      prevHref: null,
      nextHref: null,
    });

    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
    expect(html).toContain(
      `<span class="grid h-11 place-items-center rounded-lg text-muted-foreground opacity-50" aria-label="${messages.reader.previousChapter}"`,
    );
    expect(html).toContain(
      `<span class="grid h-11 place-items-center rounded-lg text-muted-foreground opacity-50" aria-label="${messages.reader.nextChapter}"`,
    );
  });
});
