import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import {
  DEFAULT_LANGUAGE,
  STORAGE_KEY,
  LANGUAGES,
  translations,
  getNested,
  interpolate,
} from '../i18n/translations';

const LanguageContext = createContext(null);

const HTML_LANG = {
  en: 'en',
  fr: 'fr',
  rw: 'rw',
  sw: 'sw',
};

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && translations[stored]) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

function persistLocal(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState(readStoredLanguage);
  const syncedUserId = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      syncedUserId.current = null;
      return;
    }
    if (syncedUserId.current === user.id) return;

    const serverLang = user.preferredLanguage;
    if (serverLang && translations[serverLang]) {
      setLanguageState(serverLang);
      persistLocal(serverLang);
    } else {
      const local = readStoredLanguage();
      setLanguageState(local);
    }
    syncedUserId.current = user.id;
  }, [user?.id, user?.preferredLanguage]);

  const setLanguage = useCallback((code) => {
    if (!translations[code]) return;
    setLanguageState(code);
    persistLocal(code);

    if (user?.id) {
      api.updateMe({ preferredLanguage: code }).catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language] || 'en';
  }, [language]);

  const t = useCallback((key, vars) => {
    const value = getNested(translations[language], key)
      ?? getNested(translations[DEFAULT_LANGUAGE], key)
      ?? key;
    return interpolate(value, vars);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    languages: LANGUAGES,
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside provider (returns English passthrough). */
export function useTranslationOptional() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key, vars) => interpolate(getNested(translations.en, key) || key, vars),
      languages: LANGUAGES,
    };
  }
  return ctx;
}

export function translateStudentNavItem(item, t) {
  const keyMap = {
    '': { label: 'nav.home', shortLabel: 'nav.home' },
    homework: { label: 'nav.myHomework', shortLabel: 'nav.homework' },
    'online-classes': { label: 'nav.liveClasses', shortLabel: 'nav.live' },
    'e-library': { label: 'nav.elibrary', shortLabel: 'nav.elibrary' },
    'e-learning': { label: 'nav.elearning', shortLabel: 'nav.elearning' },
  };
  const keys = keyMap[item.to];
  if (!keys) return item;
  return {
    ...item,
    label: t(keys.label),
    shortLabel: t(keys.shortLabel),
  };
}

function appNavBucket(role) {
  if (role === 'PARENT') return 'parent';
  if (role === 'TEACHER') return 'teacher';
  return 'admin';
}

/** Translate staff / parent / teacher sidebar item labels. */
export function translateAppNavItem(item, role, t) {
  const bucket = appNavBucket(role);
  const parts = String(item.to || '').split('/').filter(Boolean);
  let slug = 'home';
  if (parts[0] === 'campus') {
    slug = parts.length <= 2 ? 'home' : parts[2];
  } else if (parts.length) {
    slug = parts[parts.length - 1];
  }
  const key = `app.nav.${bucket}.${slug}`;
  const translated = t(key);
  return {
    ...item,
    label: translated === key ? item.label : translated,
  };
}

/** Translate sidebar group titles. */
export function translateAppNavGroup(group, role, t) {
  const bucket = appNavBucket(role);
  const key = `app.groups.${bucket}.${group.id}`;
  const translated = t(key);
  return {
    ...group,
    title: translated === key ? group.title : translated,
  };
}

