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

export type ReaderSettingsCssVars = {
  '--reader-bg': string;
  '--reader-fg': string;
  '--reader-font-size': string;
  '--reader-line-height': string;
  '--reader-font-family': string;
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

const readerFontSizes: Record<ReaderFontSize, string> = {
  s: '15px',
  m: '17px',
  l: '19px',
  xl: '22px',
};
const readerLineHeights: Record<ReaderLineHeight, string> = {
  compact: '1.5',
  default: '1.7',
  loose: '1.9',
};
const readerThemeColors: Record<ReaderTheme, { bg: string; fg: string }> = {
  white: { bg: '#FFFFFF', fg: '#171717' },
  sepia: { bg: '#F5EFE0', fg: '#211A13' },
  dark: { bg: '#1A1A1A', fg: '#E8E8E8' },
};
const readerFontFamilies: Record<ReaderFontFamily, string> = {
  sans: 'var(--font-body), ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
};

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

export function getReaderSettingsCssVars(settings: ReaderSettings): ReaderSettingsCssVars {
  const theme = readerThemeColors[settings.theme];
  return {
    '--reader-bg': theme.bg,
    '--reader-fg': theme.fg,
    '--reader-font-size': readerFontSizes[settings.fontSize],
    '--reader-line-height': readerLineHeights[settings.lineHeight],
    '--reader-font-family': readerFontFamilies[settings.fontFamily],
  };
}

export function applyReaderSettingsToDocument(
  documentLike: Pick<Document, 'documentElement'>,
  storage: Pick<Storage, 'getItem'>,
): ReaderSettings {
  const settings = loadReaderSettings(storage);
  const vars = getReaderSettingsCssVars(settings);
  const root = documentLike.documentElement;

  root.dataset.readerTheme = settings.theme;
  root.dataset.readerFontFamily = settings.fontFamily;
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));

  return settings;
}

export function getReaderSettingsBootstrapScript(): string {
  return `(() => {
  const key = ${JSON.stringify(READER_SETTINGS_KEY)};
  const defaults = ${JSON.stringify(DEFAULT_READER_SETTINGS)};
  const fontSizes = ${JSON.stringify(fontSizes)};
  const lineHeights = ${JSON.stringify(lineHeights)};
  const themes = ${JSON.stringify(themes)};
  const fontFamilies = ${JSON.stringify(fontFamilies)};
  const fontSizeValues = ${JSON.stringify(readerFontSizes)};
  const lineHeightValues = ${JSON.stringify(readerLineHeights)};
  const themeValues = ${JSON.stringify(readerThemeColors)};
  const fontFamilyValues = ${JSON.stringify(readerFontFamilies)};
  const includes = (values, value) => typeof value === 'string' && values.includes(value);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null') || {};
    const settings = {
      fontSize: includes(fontSizes, parsed.fontSize) ? parsed.fontSize : defaults.fontSize,
      lineHeight: includes(lineHeights, parsed.lineHeight) ? parsed.lineHeight : defaults.lineHeight,
      theme: includes(themes, parsed.theme) ? parsed.theme : defaults.theme,
      fontFamily: includes(fontFamilies, parsed.fontFamily) ? parsed.fontFamily : defaults.fontFamily,
      autoAdvance: typeof parsed.autoAdvance === 'boolean' ? parsed.autoAdvance : defaults.autoAdvance,
    };
    const root = document.documentElement;
    const theme = themeValues[settings.theme];
    root.dataset.readerTheme = settings.theme;
    root.dataset.readerFontFamily = settings.fontFamily;
    root.style.setProperty('--reader-bg', theme.bg);
    root.style.setProperty('--reader-fg', theme.fg);
    root.style.setProperty('--reader-font-size', fontSizeValues[settings.fontSize]);
    root.style.setProperty('--reader-line-height', lineHeightValues[settings.lineHeight]);
    root.style.setProperty('--reader-font-family', fontFamilyValues[settings.fontFamily]);
  } catch {
    const root = document.documentElement;
    const theme = themeValues[defaults.theme];
    root.dataset.readerTheme = defaults.theme;
    root.dataset.readerFontFamily = defaults.fontFamily;
    root.style.setProperty('--reader-bg', theme.bg);
    root.style.setProperty('--reader-fg', theme.fg);
    root.style.setProperty('--reader-font-size', fontSizeValues[defaults.fontSize]);
    root.style.setProperty('--reader-line-height', lineHeightValues[defaults.lineHeight]);
    root.style.setProperty('--reader-font-family', fontFamilyValues[defaults.fontFamily]);
  }
})();`;
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
