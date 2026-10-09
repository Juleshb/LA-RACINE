import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PortalEduField from '../components/PortalEduField';

const STORAGE_KEY = 'laracine-portal-theme';
const ThemeContext = createContext(null);

export function isPortalPath(pathname) {
  return /^\/(login|reset-password|set-new-password|app|profile|campuses|campus)(\/|$)/.test(pathname || '');
}

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme, portal) {
  const dark = portal && theme === 'dark';
  document.documentElement.classList.toggle('portal-canvas', portal);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#071422' : '#0ea5e9');
}

export function ThemeProvider({ children }) {
  const { pathname } = useLocation();
  const portal = isPortalPath(pathname);
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    applyTheme(theme, portal);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, portal]);

  const value = useMemo(() => ({
    theme,
    isDark: portal && theme === 'dark',
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }), [theme, portal]);

  return (
    <ThemeContext.Provider value={value}>
      {portal && <PortalEduField />}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
