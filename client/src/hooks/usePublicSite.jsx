import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const STORAGE_KEY = 'laracine_website_locale';

const FALLBACK_LOCALES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'sw', label: 'Kiswahili', native: 'Kiswahili' },
  { code: 'rw', label: 'Kinyarwanda', native: 'Ikinyarwanda' },
];

const FALLBACK = {
  school: {
    name: 'École La RACINE',
    abbreviation: 'LRS',
    country: 'RWANDA',
    province: 'WESTERN',
    district: 'RUBAVU',
    city: 'GISENYI',
    email: 'laracineschool@gmail.com',
    phone1: '0789028283',
    phone2: '0792445913',
    website: 'laracineschool.rw',
  },
  campuses: [],
  motto: 'Discipline · Intelligence · Innovation',
  locale: 'en',
  locales: FALLBACK_LOCALES,
  pages: {},
};

const PublicSiteContext = createContext(null);

function readStoredLocale() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('lang') || params.get('locale');
    if (fromQuery && FALLBACK_LOCALES.some((l) => l.code === fromQuery)) {
      return fromQuery;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FALLBACK_LOCALES.some((l) => l.code === stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function PublicSiteProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  const setLocale = useCallback((code) => {
    const next = FALLBACK_LOCALES.some((l) => l.code === code) ? code : 'en';
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      const url = new URL(window.location.href);
      url.searchParams.set('lang', next);
      window.history.replaceState({}, '', url);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Keep CMS preview links (?lang=xx) in sync when landing on public pages
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('lang') || params.get('locale');
      if (fromQuery && FALLBACK_LOCALES.some((l) => l.code === fromQuery) && fromQuery !== locale) {
        setLocaleState(fromQuery);
        localStorage.setItem(STORAGE_KEY, fromQuery);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPublicSite(locale)
      .then((res) => {
        if (!cancelled) setData({ ...FALLBACK, ...res, pages: res.pages || {} });
      })
      .catch(() => {
        if (!cancelled) setData((prev) => ({ ...prev, locale }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [locale]);

  const value = useMemo(() => ({
    ...data,
    locale,
    setLocale,
    loading,
    page: (slug) => data.pages?.[slug] || {},
  }), [data, locale, setLocale, loading]);

  return (
    <PublicSiteContext.Provider value={value}>
      {children}
    </PublicSiteContext.Provider>
  );
}

export function usePublicSite() {
  const ctx = useContext(PublicSiteContext);
  if (!ctx) throw new Error('usePublicSite must be used within PublicSiteProvider');
  return ctx;
}

/** Back-compat helper used by older public pages */
export function usePublicSchool() {
  const site = usePublicSite();
  return {
    school: site.school,
    campuses: site.campuses,
    motto: site.motto,
    loading: site.loading,
  };
}
