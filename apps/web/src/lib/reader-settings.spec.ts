import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_READER_SETTINGS,
  READER_SETTINGS_KEY,
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
});
