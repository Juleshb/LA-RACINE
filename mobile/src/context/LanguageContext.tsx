import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import {
  DEFAULT_LANGUAGE,
  STORAGE_KEY,
  LANGUAGES,
  getNested,
  interpolate,
  isLanguageCode,
  translations,
  type LanguageCode,
} from '@/src/i18n';

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  languages: typeof LANGUAGES;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

async function readStoredLanguage(): Promise<LanguageCode> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (isLanguageCode(stored) && translations[stored]) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

async function persistLocal(code: LanguageCode) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, refreshMe } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readStoredLanguage();
      if (!cancelled) {
        setLanguageState(stored);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user?.id) {
      syncedUserId.current = null;
      return;
    }
    if (syncedUserId.current === user.id) return;

    const serverLang = (user as { preferredLanguage?: string }).preferredLanguage;
    if (isLanguageCode(serverLang) && translations[serverLang]) {
      setLanguageState(serverLang);
      persistLocal(serverLang);
    }
    syncedUserId.current = user.id;
  }, [ready, user?.id, (user as { preferredLanguage?: string } | null)?.preferredLanguage]);

  const setLanguage = useCallback(
    (code: LanguageCode) => {
      if (!translations[code]) return;
      setLanguageState(code);
      persistLocal(code);
      if (user?.id) {
        api
          .updateMe({ preferredLanguage: code })
          .then(() => refreshMe?.())
          .catch(() => {});
      }
    },
    [user?.id, refreshMe],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value =
        getNested(translations[language], key) ??
        getNested(translations[DEFAULT_LANGUAGE], key) ??
        key;
      return interpolate(value, vars);
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: LANGUAGES,
    }),
    [language, setLanguage, t],
  );

  if (!ready) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: (_code: LanguageCode) => {},
      t: (key: string, vars?: Record<string, string | number>) =>
        interpolate(getNested(translations.en, key) ?? key, vars),
      languages: LANGUAGES,
    };
  }
  return ctx;
}
