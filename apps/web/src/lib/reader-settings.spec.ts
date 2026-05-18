import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_READER_SETTINGS,
  READER_SETTINGS_KEY,
  applyReaderSettingsToDocument,
  getReaderSettingsBootstrapScript,
  getReaderSettingsCssVars,
  loadReaderSettings,
  parseReaderSettings,
  saveReaderSettings,
} from './reader-settings';

describe('reader settings', () => {
  it('uses defaults for empty or invalid JSON', () => {
    expect(parseReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS);
    expect(parseReaderSettings('{bad')).toEqual(DEFAULT_READER_SETTINGS);
  });

  it('accepts valid persisted values', () => {
    expect(
      parseReaderSettings(
        JSON.stringify({
          fontSize: 'xl',
          lineHeight: 'loose',
          theme: 'dark',
          fontFamily: 'serif',
          autoAdvance: true,
        }),
      ),
    ).toEqual({
      fontSize: 'xl',
      lineHeight: 'loose',
      theme: 'dark',
      fontFamily: 'serif',
      autoAdvance: true,
    });
  });

  it('sanitizes unknown values field by field', () => {
    expect(
      parseReaderSettings(
        JSON.stringify({
          fontSize: 'huge',
          lineHeight: 'default',
          theme: 'sepia',
          fontFamily: 'mono',
          autoAdvance: 'yes',
        }),
      ),
    ).toEqual({ ...DEFAULT_READER_SETTINGS, lineHeight: 'default', theme: 'sepia' });
  });

  it('round-trips through localStorage-compatible storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
    };
    const settings = { ...DEFAULT_READER_SETTINGS, fontSize: 'l' as const, autoAdvance: true };

    saveReaderSettings(storage, settings);

    expect(storage.setItem).toHaveBeenCalledWith(READER_SETTINGS_KEY, JSON.stringify(settings));
    expect(loadReaderSettings(storage)).toEqual(settings);
  });

  it('derives pre-paint CSS variables and attributes from sanitized settings', () => {
    expect(
      getReaderSettingsCssVars({
        ...DEFAULT_READER_SETTINGS,
        fontSize: 'xl',
        lineHeight: 'loose',
        theme: 'dark',
        fontFamily: 'serif',
      }),
    ).toEqual({
      '--reader-bg': '#1A1A1A',
      '--reader-fg': '#E8E8E8',
      '--reader-font-size': '22px',
      '--reader-line-height': '1.9',
      '--reader-font-family': 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    });
  });

  it('applies sanitized settings to documentElement without persisting new fields', () => {
    const style = new Map<string, string>();
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: { setProperty: vi.fn((key: string, value: string) => style.set(key, value)) },
    };
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          fontSize: 'huge',
          lineHeight: 'compact',
          theme: 'sepia',
          fontFamily: 'serif',
        }),
      ),
      setItem: vi.fn(),
    };

    applyReaderSettingsToDocument(
      { documentElement: documentElement as unknown as HTMLElement },
      storage,
    );

    expect(documentElement.dataset.readerTheme).toBe('sepia');
    expect(documentElement.dataset.readerFontFamily).toBe('serif');
    expect(style.get('--reader-font-size')).toBe('17px');
    expect(style.get('--reader-line-height')).toBe('1.5');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('ships a standalone bootstrap script that reads the existing key before paint', () => {
    const script = getReaderSettingsBootstrapScript();

    expect(script).toContain(READER_SETTINGS_KEY);
    expect(script).toContain('document.documentElement');
    expect(script).toContain('--reader-font-size');
    expect(script).not.toContain('setItem');
  });
});
