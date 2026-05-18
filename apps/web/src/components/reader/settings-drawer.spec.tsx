import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_READER_SETTINGS } from '@/lib/reader-settings';
import { SettingsDrawer } from './settings-drawer';

vi.mock('lucide-react', () => ({
  X: () => <svg aria-hidden="true" />,
}));

describe('SettingsDrawer accessibility', () => {
  it('keeps setting controls keyboard reachable and screen-reader labeled', () => {
    const html = renderToStaticMarkup(
      <SettingsDrawer
        open
        settings={DEFAULT_READER_SETTINGS}
        onChange={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain('Changes apply before each chapter paints');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Font size"');
    expect(html).toContain('aria-label="Line height"');
    expect(html).toContain('aria-label="Background"');
    expect(html).toContain('aria-label="Font"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('type="checkbox"');
  });

  it('keeps the closed drawer hidden from assistive tech while preserving a focus target for reopen', () => {
    const html = renderToStaticMarkup(
      <SettingsDrawer
        open={false}
        settings={DEFAULT_READER_SETTINGS}
        onChange={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('tabindex="-1"');
  });
});
