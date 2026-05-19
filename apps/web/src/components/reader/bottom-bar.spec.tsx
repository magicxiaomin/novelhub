import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { messages } from '@novelhub/shared';
import { getByRole } from './test-a11y-queries';
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

const renderBottomBar = (props?: Partial<React.ComponentProps<typeof ReaderBottomBar>>) => (
  <ReaderBottomBar
    visible
    prevHref="/read/book-1/1"
    nextHref="/read/book-1/3"
    onChapters={() => undefined}
    onSettings={() => undefined}
    {...props}
  />
);

describe('ReaderBottomBar accessible semantics', () => {
  it('labels the bottom chapter navigation landmark', () => {
    expect(
      getByRole(renderBottomBar(), 'navigation', { name: messages.reader.chapters }).type,
    ).toBe('nav');
  });

  it('exposes previous and next chapter links when hrefs are present', () => {
    const bottomBar = renderBottomBar();

    expect(getByRole(bottomBar, 'link', { name: messages.reader.previousChapter }).props.href).toBe(
      '/read/book-1/1',
    );
    expect(getByRole(bottomBar, 'link', { name: messages.reader.nextChapter }).props.href).toBe(
      '/read/book-1/3',
    );
  });

  it('exposes chapter and settings buttons by localized accessible names', () => {
    const onChapters = vi.fn();
    const onSettings = vi.fn();
    const bottomBar = renderBottomBar({ onChapters, onSettings });

    getByRole(bottomBar, 'button', { name: messages.reader.chapters }).props.onClick!();
    getByRole(bottomBar, 'button', { name: messages.reader.settings }).props.onClick!();

    expect(onChapters).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('removes unavailable previous and next controls from link navigation', () => {
    const bottomBar = renderBottomBar({ prevHref: null, nextHref: null });

    expect(() => getByRole(bottomBar, 'link', { name: messages.reader.previousChapter })).toThrow(
      'found 0',
    );
    expect(() => getByRole(bottomBar, 'link', { name: messages.reader.nextChapter })).toThrow(
      'found 0',
    );
  });
});
