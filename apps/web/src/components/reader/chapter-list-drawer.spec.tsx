import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ChapterSummary } from '@/lib/types';
import { messages } from '@novelhub/shared';
import { getByLabelText, getByRole } from './test-a11y-queries';
import { ChapterListDrawer } from './chapter-list-drawer';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
vi.mock('lucide-react', () => ({
  Lock: ({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) => (
    <svg aria-label={ariaLabel} data-icon="lock" />
  ),
  X: () => <svg aria-hidden="true" data-icon="x" />,
}));
vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' '),
}));

vi.stubGlobal('React', React);

const chapters: ChapterSummary[] = [
  {
    id: 'chapter-1',
    bookId: 'book-1',
    order: 1,
    title: 'The Door Opens',
    isFree: true,
    wordCount: 900,
  },
  {
    id: 'chapter-2',
    bookId: 'book-1',
    order: 2,
    title: 'The Locked Hall',
    isFree: false,
    wordCount: 1200,
  },
  {
    id: 'chapter-3',
    bookId: 'book-1',
    order: 3,
    title: 'A Friend Returns',
    isFree: false,
    wordCount: 1100,
  },
];

const renderDrawer = (props?: Partial<React.ComponentProps<typeof ChapterListDrawer>>) => (
  <ChapterListDrawer
    open
    bookId="book-1"
    currentChapterId="chapter-2"
    chapters={chapters}
    unlockedChapterIds={new Set(['chapter-2'])}
    isAnonymous={false}
    onClose={() => undefined}
    {...props}
  />
);

const chapterStatusLabel = (chapterButton: ReturnType<typeof getByRole>): string | undefined => {
  const statusNode = React.Children.toArray(chapterButton.props.children).at(-1);
  if (!React.isValidElement<{ children?: React.ReactNode; 'aria-label'?: string }>(statusNode)) {
    return undefined;
  }

  const ariaLabel = statusNode.props['aria-label'];
  if (typeof ariaLabel === 'string') {
    return ariaLabel;
  }

  return React.Children.toArray(statusNode.props.children).join('');
};

describe('ChapterListDrawer accessible semantics', () => {
  it('exposes a localized modal chapter dialog and close button', () => {
    const onClose = vi.fn();
    const drawer = renderDrawer({ onClose });
    const dialog = getByRole(drawer, 'dialog', { name: messages.reader.chapters });

    expect(dialog.props['aria-modal']).toBe('true');
    getByLabelText(drawer, messages.reader.drawerClose).props.onClick!();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the current chapter button with aria-current true', () => {
    const currentChapter = getByRole(renderDrawer(), 'button', { name: /The Locked Hall/ });

    expect(currentChapter.props['aria-current']).toBe('true');
  });

  it('exposes locked chapter rows with the localized locked label', () => {
    const drawer = renderDrawer({
      currentChapterId: 'chapter-1',
      unlockedChapterIds: new Set(['chapter-3']),
    });

    expect(
      getByRole(drawer, 'button', { name: /The Locked Hall/ }).props['aria-current'],
    ).toBeUndefined();
    expect(getByLabelText(drawer, messages.reader.locked).props['aria-label']).toBe(
      messages.reader.locked,
    );
  });

  it('shows free chapters as free even for anonymous readers', () => {
    const chapterButton = getByRole(renderDrawer({ isAnonymous: true }), 'button', {
      name: /The Door Opens/,
    });

    expect(chapterStatusLabel(chapterButton)).toBe(messages.reader.free);
  });

  it('locks paid chapters for anonymous readers', () => {
    const chapterButton = getByRole(renderDrawer({ isAnonymous: true }), 'button', {
      name: /The Locked Hall/,
    });

    expect(chapterStatusLabel(chapterButton)).toBe(messages.reader.locked);
  });

  it('changes a paid chapter from locked to unlocked when authenticated unlock-list data includes it', () => {
    const lockedDrawer = renderDrawer({
      currentChapterId: 'chapter-1',
      isAnonymous: false,
      unlockedChapterIds: new Set(['chapter-3']),
    });
    const unlockedDrawer = renderDrawer({
      currentChapterId: 'chapter-1',
      isAnonymous: false,
      unlockedChapterIds: new Set(['chapter-2']),
    });

    expect(chapterStatusLabel(getByRole(lockedDrawer, 'button', { name: /The Locked Hall/ }))).toBe(
      messages.reader.locked,
    );
    expect(
      chapterStatusLabel(getByRole(unlockedDrawer, 'button', { name: /The Locked Hall/ })),
    ).toBe(messages.reader.unlocked);
  });

  it('locks paid chapters for authenticated readers without chapter unlocks', () => {
    const chapterButton = getByRole(
      renderDrawer({
        isAnonymous: false,
        unlockedChapterIds: new Set(['chapter-3']),
      }),
      'button',
      { name: /The Locked Hall/ },
    );

    expect(chapterStatusLabel(chapterButton)).toBe(messages.reader.locked);
  });

  it('closes and routes to the selected chapter when a chapter button is activated', () => {
    push.mockClear();
    const onClose = vi.fn();
    const chapterButton = getByRole(renderDrawer({ onClose }), 'button', {
      name: /A Friend Returns/,
    });

    chapterButton.props.onClick!();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/read/book-1/3');
  });
});
