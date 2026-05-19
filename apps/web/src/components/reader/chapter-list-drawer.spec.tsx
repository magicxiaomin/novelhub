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
