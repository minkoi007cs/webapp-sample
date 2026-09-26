import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const decodeTokenPayload = (token: string | null): Record<string, unknown> | null => {
  if (!token) return null;

  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getThemeStorageKey = () => {
  const payload = decodeTokenPayload(localStorage.getItem('token'));
  const userKey = typeof payload?.sub === 'string'
    ? payload.sub
    : typeof payload?.email === 'string'
      ? payload.email
      : 'guest';

  return `fm-theme:${userKey}`;
};

const getInitialThemeMode = (): ThemeMode => {
  const saved = localStorage.getItem(getThemeStorageKey());
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return 'light';
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getInitialThemeMode());

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem(getThemeStorageKey(), themeMode);
  }, [themeMode]);

  const value = useMemo<ThemeContextValue>(() => ({
    themeMode,
    setThemeMode: (mode) => setThemeModeState(mode),
    toggleThemeMode: () => setThemeModeState((current) => (current === 'light' ? 'dark' : 'light')),
  }), [themeMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
};
