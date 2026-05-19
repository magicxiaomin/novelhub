import * as React from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { messages } from '@novelhub/shared';
import { getByRole } from './test-a11y-queries';
import { ReaderTopBar } from './top-bar';

const back = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
}));

vi.stubGlobal('React', React);

const renderTopBar = (props?: Partial<React.ComponentProps<typeof ReaderTopBar>>) =>
  ReaderTopBar({
    title: 'Chapter 7: The Hidden Door',
    visible: true,
    onSettings: () => undefined,
    ...props,
  }) as ReactElement;

describe('ReaderTopBar accessible semantics', () => {
  it('exposes the current chapter title as the top-level heading', () => {
    const topBar = renderTopBar();

    expect(getByRole(topBar, 'heading', { name: 'Chapter 7: The Hidden Door' }).type).toBe('h1');
    expect(topBar.props.className).toContain('translate-y-0');
  });

  it('exposes a localized Back button that routes back', () => {
    back.mockClear();
    const backButton = getByRole(renderTopBar(), 'button', { name: messages.reader.back });

    expect(backButton.props.type).toBe('button');
    backButton.props.onClick!();

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('exposes a localized Settings button that opens settings', () => {
    const onSettings = vi.fn();
    const settingsButton = getByRole(renderTopBar({ onSettings }), 'button', {
      name: messages.reader.settings,
    });

    expect(settingsButton.props.type).toBe('button');
    settingsButton.props.onClick!();

    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
