import data from './translations.json';

export const LANGUAGES = data.LANGUAGES as {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}[];

export const DEFAULT_LANGUAGE = (data.DEFAULT_LANGUAGE || 'en') as LanguageCode;
export const STORAGE_KEY = data.STORAGE_KEY || 'laracine_lang';

export type LanguageCode = 'en' | 'fr' | 'rw' | 'sw';

export const translations = data.translations as Record<LanguageCode, Record<string, unknown>>;

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'en' || value === 'fr' || value === 'rw' || value === 'sw';
}

export function getNested(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function interpolate(template: unknown, vars?: Record<string, string | number>): string {
  if (typeof template !== 'string') return String(template ?? '');
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : `{{${key}}}`,
  );
}
