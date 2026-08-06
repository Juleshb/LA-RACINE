/** Soft, kid-friendly palette rooted in La Racine brand + logo accents */

export const brand = {
  50: '#eef9ff',
  100: '#dff3ff',
  200: '#b8e6ff',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',
} as const;

export type ThemeColors = {
  brand: string;
  brandDark: string;
  brandSoft: string;
  brandMid: string;
  brandBorder: string;
  ink: string;
  teal: string;
  tealSoft: string;
  rose: string;
  roseSoft: string;
  indigo: string;
  indigoSoft: string;
  violet: string;
  violetSoft: string;
  cyan: string;
  cyanSoft: string;
  lime: string;
  limeSoft: string;
  yellow: string;
  yellowSoft: string;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
  bubble: string;
  inputBg: string;
  overlay: string;
};

export type AccentColors = {
  magenta: string;
  magentaSoft: string;
  purple: string;
  purpleSoft: string;
  blue: string;
  blueSoft: string;
  teal: string;
  tealSoft: string;
  lime: string;
  limeSoft: string;
  yellow: string;
  yellowSoft: string;
  orange: string;
  orangeSoft: string;
  coral: string;
  coralSoft: string;
};

export const lightAccent: AccentColors = {
  magenta: '#ec4899',
  magentaSoft: '#fce7f3',
  purple: '#8b5cf6',
  purpleSoft: '#f3e8ff',
  blue: '#3b82f6',
  blueSoft: '#dbeafe',
  teal: '#14b8a6',
  tealSoft: '#ccfbf1',
  lime: '#84cc16',
  limeSoft: '#ecfccb',
  yellow: '#f59e0b',
  yellowSoft: '#fef3c7',
  orange: '#fb923c',
  orangeSoft: '#ffedd5',
  coral: '#fb7185',
  coralSoft: '#ffe4e6',
};

export const darkAccent: AccentColors = {
  magenta: '#f472b6',
  magentaSoft: '#4c1d3a',
  purple: '#a78bfa',
  purpleSoft: '#2e1065',
  blue: '#60a5fa',
  blueSoft: '#1e3a5f',
  teal: '#2dd4bf',
  tealSoft: '#134e4a',
  lime: '#a3e635',
  limeSoft: '#365314',
  yellow: '#fbbf24',
  yellowSoft: '#78350f',
  orange: '#fb923c',
  orangeSoft: '#7c2d12',
  coral: '#fb7185',
  coralSoft: '#881337',
};

export const lightColors: ThemeColors = {
  brand: brand[600],
  brandDark: brand[900],
  brandSoft: brand[100],
  brandMid: brand[700],
  brandBorder: brand[200],
  ink: '#0c4a6e',
  teal: lightAccent.teal,
  tealSoft: lightAccent.tealSoft,
  rose: lightAccent.magenta,
  roseSoft: lightAccent.magentaSoft,
  indigo: lightAccent.blue,
  indigoSoft: lightAccent.blueSoft,
  violet: lightAccent.purple,
  violetSoft: lightAccent.purpleSoft,
  cyan: lightAccent.teal,
  cyanSoft: lightAccent.tealSoft,
  lime: lightAccent.lime,
  limeSoft: lightAccent.limeSoft,
  yellow: lightAccent.yellow,
  yellowSoft: lightAccent.yellowSoft,
  bg: '#e8f7ff',
  surface: '#ffffff',
  text: '#1e3a5f',
  textMuted: '#5b7a99',
  border: '#cfe9f8',
  danger: '#e11d48',
  success: '#16a34a',
  warning: '#d97706',
  bubble: '#fff7ed',
  inputBg: '#ffffff',
  overlay: 'rgba(15,23,42,0.55)',
};

export const darkColors: ThemeColors = {
  brand: brand[400],
  brandDark: brand[200],
  brandSoft: '#0c4a6e',
  brandMid: brand[300],
  brandBorder: '#1e3a5f',
  ink: '#e0f2fe',
  teal: darkAccent.teal,
  tealSoft: darkAccent.tealSoft,
  rose: darkAccent.magenta,
  roseSoft: darkAccent.magentaSoft,
  indigo: darkAccent.blue,
  indigoSoft: darkAccent.blueSoft,
  violet: darkAccent.purple,
  violetSoft: darkAccent.purpleSoft,
  cyan: darkAccent.teal,
  cyanSoft: darkAccent.tealSoft,
  lime: darkAccent.lime,
  limeSoft: darkAccent.limeSoft,
  yellow: darkAccent.yellow,
  yellowSoft: darkAccent.yellowSoft,
  bg: '#0b1220',
  surface: '#111827',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  border: '#1e293b',
  danger: '#fb7185',
  success: '#4ade80',
  warning: '#fbbf24',
  bubble: '#1e293b',
  inputBg: '#0f172a',
  overlay: 'rgba(0,0,0,0.65)',
};

/** @deprecated Prefer useTheme().colors — mutable so late style factories can sync */
export const colors: ThemeColors = { ...lightColors };

/** @deprecated Prefer useTheme().accent */
export const accent: AccentColors = { ...lightAccent };

export function syncThemePalette(next: { colors: ThemeColors; accent: AccentColors }) {
  Object.assign(colors, next.colors);
  Object.assign(accent, next.accent);
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Extra-round for a friendly kids UI */
export const radius = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const school = {
  name: 'École La RACINE',
  shortName: 'La RACINE',
  motto: 'Discipline · Intelligence · Innovation',
  tagline: 'My learning adventure',
};

export type ThemePreference = 'light' | 'dark' | 'system';
