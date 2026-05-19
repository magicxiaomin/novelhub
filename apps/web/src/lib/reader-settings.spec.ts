import vm from 'node:vm';

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

  it('uses defaults when the persisted payload is missing keys', () => {
    expect(
      parseReaderSettings(
        JSON.stringify({
          version: 1,
          settings: {},
        }),
      ),
    ).toEqual(DEFAULT_READER_SETTINGS);
  });

  it('keeps valid partial keys and defaults missing keys', () => {
    expect(
      parseReaderSettings(
        JSON.stringify({
          version: 1,
          settings: {
            fontSize: 'l',
            lineHeight: 'compact',
          },
        }),
      ),
    ).toEqual({
      ...DEFAULT_READER_SETTINGS,
      fontSize: 'l',
      lineHeight: 'compact',
    });
  });

  it('accepts valid current-version persisted values', () => {
    expect(
      parseReaderSettings(
        JSON.stringify({
          version: 1,
          settings: {
            fontSize: 'xl',
            lineHeight: 'loose',
            theme: 'dark',
            fontFamily: 'serif',
            autoAdvance: true,
          },
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

  it.each([
    ['s', 'compact'],
    ['m', 'default'],
    ['l', 'loose'],
    ['xl', 'default'],
  ] as const)(
    'accepts valid font-size and line-height combination %s/%s',
    (fontSize, lineHeight) => {
      expect(
        parseReaderSettings(
          JSON.stringify({
            version: 1,
            settings: {
              ...DEFAULT_READER_SETTINGS,
              fontSize,
              lineHeight,
            },
          }),
        ),
      ).toMatchObject({ fontSize, lineHeight });
    },
  );

  it('falls back to defaults for unknown or legacy payload versions', () => {
    expect(
      parseReaderSettings(
        JSON.stringify({
          version: 2,
          settings: {
            fontSize: 'xl',
            lineHeight: 'loose',
            theme: 'dark',
            fontFamily: 'serif',
            autoAdvance: true,
          },
        }),
      ),
    ).toEqual(DEFAULT_READER_SETTINGS);

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
    ).toEqual(DEFAULT_READER_SETTINGS);
  });

  it('sanitizes unknown values field by field', () => {
    expect(
      parseReaderSettings(
        JSON.stringify({
          version: 1,
          settings: {
            fontSize: 'huge',
            lineHeight: 'default',
            theme: 'sepia',
            fontFamily: 'mono',
            autoAdvance: 'yes',
          },
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

    expect(storage.setItem).toHaveBeenCalledWith(
      READER_SETTINGS_KEY,
      JSON.stringify({ version: 1, settings }),
    );
    expect(loadReaderSettings(storage)).toEqual(settings);
  });

  it('propagates storage quota failures when saving reader settings', () => {
    const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
    const storage = {
      setItem: vi.fn(() => {
        throw quotaError;
      }),
    };

    expect(() => saveReaderSettings(storage, DEFAULT_READER_SETTINGS)).toThrow(quotaError);
    expect(storage.setItem).toHaveBeenCalledWith(
      READER_SETTINGS_KEY,
      JSON.stringify({ version: 1, settings: DEFAULT_READER_SETTINGS }),
    );
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
          version: 1,
          settings: {
            fontSize: 'huge',
            lineHeight: 'compact',
            theme: 'sepia',
            fontFamily: 'serif',
          },
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

  it('executes the pre-hydration bootstrap contract against persisted settings', () => {
    const style = new Map<string, string>();
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: { setProperty: vi.fn((key: string, value: string) => style.set(key, value)) },
    };
    const localStorage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          version: 1,
          settings: {
            ...DEFAULT_READER_SETTINGS,
            fontSize: 'xl',
            lineHeight: 'loose',
            theme: 'dark',
            fontFamily: 'serif',
            autoAdvance: true,
          },
        }),
      ),
    };

    vm.runInNewContext(getReaderSettingsBootstrapScript(), {
      document: { documentElement },
      window: { localStorage },
    });

    expect(localStorage.getItem).toHaveBeenCalledWith(READER_SETTINGS_KEY);
    expect(documentElement.dataset.readerTheme).toBe('dark');
    expect(documentElement.dataset.readerFontFamily).toBe('serif');
    expect(style.get('--reader-bg')).toBe('#1A1A1A');
    expect(style.get('--reader-font-size')).toBe('22px');
    expect(style.get('--reader-line-height')).toBe('1.9');
  });

  it('executes the pre-hydration bootstrap contract with defaults when persisted JSON is corrupted', () => {
    const style = new Map<string, string>();
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: { setProperty: vi.fn((key: string, value: string) => style.set(key, value)) },
    };
    const localStorage = {
      getItem: vi.fn(() => '{bad'),
    };

    expect(() =>
      vm.runInNewContext(getReaderSettingsBootstrapScript(), {
        document: { documentElement },
        window: { localStorage },
      }),
    ).not.toThrow();

    expect(localStorage.getItem).toHaveBeenCalledWith(READER_SETTINGS_KEY);
    expect(documentElement.dataset.readerTheme).toBe(DEFAULT_READER_SETTINGS.theme);
    expect(documentElement.dataset.readerFontFamily).toBe(DEFAULT_READER_SETTINGS.fontFamily);
    expect(style.get('--reader-bg')).toBe('#FFFFFF');
    expect(style.get('--reader-font-size')).toBe('17px');
    expect(style.get('--reader-line-height')).toBe('1.7');
  });

  it('executes the pre-hydration bootstrap contract with defaults when localStorage throws', () => {
    const style = new Map<string, string>();
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: { setProperty: vi.fn((key: string, value: string) => style.set(key, value)) },
    };
    const storageError = new DOMException('blocked', 'SecurityError');
    const localStorage = {
      getItem: vi.fn(() => {
        throw storageError;
      }),
    };

    expect(() =>
      vm.runInNewContext(getReaderSettingsBootstrapScript(), {
        document: { documentElement },
        window: { localStorage },
      }),
    ).not.toThrow();

    expect(localStorage.getItem).toHaveBeenCalledWith(READER_SETTINGS_KEY);
    expect(documentElement.dataset.readerTheme).toBe(DEFAULT_READER_SETTINGS.theme);
    expect(documentElement.dataset.readerFontFamily).toBe(DEFAULT_READER_SETTINGS.fontFamily);
    expect(style.get('--reader-bg')).toBe('#FFFFFF');
    expect(style.get('--reader-font-size')).toBe('17px');
    expect(style.get('--reader-line-height')).toBe('1.7');
  });
});
