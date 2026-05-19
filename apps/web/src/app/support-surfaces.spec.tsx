import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GlobalError from './error';
import Loading from './loading';

const { messages } = vi.hoisted(() => ({
  messages: {
    errors: {
      somethingWrong: 'Something went wrong',
      pleaseTryAgain: 'Please try again.',
      tryAgain: 'Try again',
    },
  } as const,
}));

vi.mock('@novelhub/shared', () => ({
  messages,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-root-skeleton': true, className }),
}));

beforeEach(() => {
  vi.stubGlobal('React', React);
});

describe('root support surfaces', () => {
  it('renders the root loading surface with only the imported skeleton primitive', () => {
    const html = renderToStaticMarkup(<Loading />);

    expect(html).toContain('max-w-mobile');
    expect(html).toContain('data-root-skeleton="true"');
    expect(html.match(/data-root-skeleton="true"/g)).toHaveLength(6);
    expect(html).toContain('aspect-[16/9] rounded-2xl');
    expect(html).toContain('h-48 w-36 shrink-0 rounded-xl');
  });

  it('renders the root error surface with shared copy and digest context', () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(
      <GlobalError
        error={Object.assign(new Error('root failed'), { digest: 'digest-450' })}
        reset={reset}
      />,
    );

    expect(html).toContain(messages.errors.somethingWrong);
    expect(html).toContain(`${messages.errors.pleaseTryAgain} (digest-450)`);
    expect(html).toContain(messages.errors.tryAgain);
    expect(html).toContain('type="button"');
    expect(reset).not.toHaveBeenCalled();
  });

  it('renders the root error fallback copy without a digest', () => {
    const html = renderToStaticMarkup(
      <GlobalError error={new Error('root failed')} reset={vi.fn()} />,
    );

    expect(html).toContain(messages.errors.somethingWrong);
    expect(html).toContain(messages.errors.pleaseTryAgain);
    expect(html).not.toContain('digest-');
  });
});
