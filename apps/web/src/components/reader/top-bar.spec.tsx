import React, { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { messages } from '@novelhub/shared';
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

const childElements = (element: ReactElement): ReactElement[] =>
  React.Children.toArray(element.props.children).filter(React.isValidElement) as ReactElement[];

const getControls = (
  header: ReactElement,
): { backButton: ReactElement; title: ReactElement; settingsButton: ReactElement } => {
  const [inner] = childElements(header);
  expect(inner).toBeDefined();

  const [backButton, title, settingsButton] = childElements(inner as ReactElement);
  expect(backButton).toBeDefined();
  expect(title).toBeDefined();
  expect(settingsButton).toBeDefined();

  return {
    backButton: backButton as ReactElement,
    title: title as ReactElement,
    settingsButton: settingsButton as ReactElement,
  };
};

describe('ReaderTopBar contract', () => {
  it('renders the chapter title and toggles visibility classes', () => {
    const visible = renderTopBar({ visible: true });
    const hidden = renderTopBar({ visible: false });

    expect(getControls(visible).title.props.children).toBe('Chapter 7: The Hidden Door');
    expect(visible.props.className).toContain('translate-y-0');
    expect(visible.props.className).not.toContain('-translate-y-full');
    expect(hidden.props.className).toContain('-translate-y-full');
    expect(hidden.props.className).not.toContain('translate-y-0');
  });

  it('routes back when the accessible Back button is clicked', () => {
    back.mockClear();
    const { backButton } = getControls(renderTopBar());

    expect(backButton.props['aria-label']).toBe(messages.reader.back);
    backButton.props.onClick();

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('calls onSettings when the accessible Settings button is clicked', () => {
    const onSettings = vi.fn();
    const { settingsButton } = getControls(renderTopBar({ onSettings }));

    expect(settingsButton.props['aria-label']).toBe(messages.reader.settings);
    settingsButton.props.onClick();

    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
