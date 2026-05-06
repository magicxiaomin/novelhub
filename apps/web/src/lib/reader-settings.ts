export const READER_SETTINGS_KEY = 'reader-settings-v1';

export type ReaderFontSize = 's' | 'm' | 'l' | 'xl';
export type ReaderLineHeight = 'compact' | 'default' | 'loose';
export type ReaderTheme = 'white' | 'sepia' | 'dark';
export type ReaderFontFamily = 'sans' | 'serif';

export type ReaderSettings = {
  fontSize: ReaderFontSize;
  lineHeight: ReaderLineHeight;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  autoAdvance: boolean;
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 'm',
  lineHeight: 'default',
  theme: 'white',
  fontFamily: 'sans',
  autoAdvance: false,
};

const fontSizes: ReaderFontSize[] = ['s', 'm', 'l', 'xl'];
const lineHeights: ReaderLineHeight[] = ['compact', 'default', 'loose'];
const themes: ReaderTheme[] = ['white', 'sepia', 'dark'];
const fontFamilies: ReaderFontFamily[] = ['sans', 'serif'];

const includes = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && values.includes(value as T);

export function parseReaderSettings(raw: string | null): ReaderSettings {
  if (!raw) return DEFAULT_READER_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof ReaderSettings, unknown>>;
    return {
      fontSize: includes(fontSizes, parsed.fontSize)
        ? parsed.fontSize
        : DEFAULT_READER_SETTINGS.fontSize,
      lineHeight: includes(lineHeights, parsed.lineHeight)
        ? parsed.lineHeight
        : DEFAULT_READER_SETTINGS.lineHeight,
      theme: includes(themes, parsed.theme) ? parsed.theme : DEFAULT_READER_SETTINGS.theme,
      fontFamily: includes(fontFamilies, parsed.fontFamily)
        ? parsed.fontFamily
        : DEFAULT_READER_SETTINGS.fontFamily,
      autoAdvance:
        typeof parsed.autoAdvance === 'boolean'
          ? parsed.autoAdvance
          : DEFAULT_READER_SETTINGS.autoAdvance,
    };
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function loadReaderSettings(storage: Pick<Storage, 'getItem'>): ReaderSettings {
  return parseReaderSettings(storage.getItem(READER_SETTINGS_KEY));
}

export function saveReaderSettings(
  storage: Pick<Storage, 'setItem'>,
  settings: ReaderSettings,
): void {
  storage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings));
}
