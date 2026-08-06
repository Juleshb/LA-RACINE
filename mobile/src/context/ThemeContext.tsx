import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  darkAccent,
  darkColors,
  lightAccent,
  lightColors,
  syncThemePalette,
  type AccentColors,
  type ThemeColors,
  type ThemePreference,
} from '@/src/theme';

const STORAGE_KEY = 'laracine_theme_preference';

type ThemeContextValue = {
  preference: ThemePreference;
  /** Resolved light/dark after applying system preference */
  resolved: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
  accent: AccentColors;
  setPreference: (next: ThemePreference) => void;
  toggleDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setPreferenceState(stored);
        }
      } catch {
        // keep default
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const resolved: 'light' | 'dark' = useMemo(() => {
    if (preference === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return preference;
  }, [preference, systemScheme]);

  const isDark = resolved === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const accent = isDark ? darkAccent : lightAccent;

  useEffect(() => {
    syncThemePalette({ colors, accent });
  }, [colors, accent]);

  const toggleDark = useCallback(() => {
    setPreference(isDark ? 'light' : 'dark');
  }, [isDark, setPreference]);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      isDark,
      colors,
      accent,
      setPreference,
      toggleDark,
    }),
    [preference, resolved, isDark, colors, accent, setPreference, toggleDark],
  );

  // Avoid a light→dark flash before SecureStore loads when user chose dark
  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback for rare renders outside provider
    const systemDark = Appearance.getColorScheme() === 'dark';
    return {
      preference: 'system' as ThemePreference,
      resolved: (systemDark ? 'dark' : 'light') as 'light' | 'dark',
      isDark: systemDark,
      colors: systemDark ? darkColors : lightColors,
      accent: systemDark ? darkAccent : lightAccent,
      setPreference: () => {},
      toggleDark: () => {},
    };
  }
  return ctx;
}
