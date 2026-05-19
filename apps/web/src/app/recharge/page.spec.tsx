import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { messages } = vi.hoisted(() => ({
  messages: {
    recharge: {
      title: 'Recharge',
    },
  } as const,
}));

vi.mock('@novelhub/shared', () => ({
  messages,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-recharge-skeleton': true, className }),
}));

const neverSettling = new Promise(() => undefined);

const loadRechargePage = async ({ suspendClient = false } = {}) => {
  vi.doMock('./recharge-client', () => ({
    RechargeClient: () => {
      if (suspendClient) {
        throw neverSettling;
      }

      return React.createElement('section', { 'data-recharge-client': true });
    },
  }));

  return import('./page');
};

beforeEach(() => {
  vi.stubGlobal('React', React);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('recharge page static render', () => {
  it('exports metadata from shared recharge copy', async () => {
    const { metadata } = await loadRechargePage();

    expect(metadata).toEqual({ title: messages.recharge.title });
  });

  it('renders the recharge client branch without invoking checkout handlers', async () => {
    const { default: RechargePage } = await loadRechargePage();

    const html = renderToStaticMarkup(<RechargePage />);

    expect(html).toContain('data-recharge-client="true"');
    expect(html).not.toContain('data-recharge-skeleton="true"');
  });

  it('renders the static suspense fallback branch with only skeleton primitives', async () => {
    const { default: RechargePage } = await loadRechargePage({ suspendClient: true });

    const html = renderToStaticMarkup(<RechargePage />);

    expect(html).toContain('max-w-mobile');
    expect(html).toContain('min-h-dvh');
    expect(html.match(/data-recharge-skeleton="true"/g)).toHaveLength(2);
    expect(html).toContain('h-16 rounded-lg');
    expect(html).toContain('mt-4 h-64 rounded-lg');
    expect(html).not.toContain('data-recharge-client="true"');
  });
});
