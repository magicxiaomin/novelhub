import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: 'font-body' }),
}));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => null,
}));

describe('root metadata', () => {
  it('uses a safe local metadataBase so relative social images resolve absolutely', async () => {
    const { metadata } = await import('./layout');

    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
  });

  it('renders reader settings bootstrap in head before body content can paint', async () => {
    vi.stubGlobal('React', React);
    const { default: RootLayout } = await import('./layout');

    const html = renderToStaticMarkup(
      React.createElement(
        RootLayout,
        null,
        React.createElement('main', { 'data-testid': 'reader-content' }, 'Reader content'),
      ),
    );

    const bootstrapIndex = html.indexOf('id="reader-settings-bootstrap"');
    const bodyIndex = html.indexOf('<body>');
    const contentIndex = html.indexOf('Reader content');

    expect(bootstrapIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(bootstrapIndex);
    expect(contentIndex).toBeGreaterThan(bodyIndex);
  });
});
