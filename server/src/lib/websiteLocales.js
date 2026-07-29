export const WEBSITE_LOCALES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'sw', label: 'Kiswahili', native: 'Kiswahili' },
  { code: 'rw', label: 'Kinyarwanda', native: 'Ikinyarwanda' },
];

export const WEBSITE_LOCALE_CODES = WEBSITE_LOCALES.map((l) => l.code);
export const DEFAULT_WEBSITE_LOCALE = 'en';

export const WEBSITE_PAGE_SLUGS = [
  'nav',
  'home',
  'about',
  'academics',
  'locations',
  'announcements',
  'news',
  'events',
  'gallery',
  'admissions',
  'contact',
];

export function normalizeLocale(locale) {
  const code = String(locale || DEFAULT_WEBSITE_LOCALE).toLowerCase().slice(0, 2);
  return WEBSITE_LOCALE_CODES.includes(code) ? code : DEFAULT_WEBSITE_LOCALE;
}
