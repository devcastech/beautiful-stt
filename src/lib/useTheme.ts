import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

const readInitialTheme = (): Theme => {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const applyTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage bloqueado — el atributo igual queda aplicado */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, applyTheme]);

  // Sigue al sistema mientras el usuario no haya elegido manualmente.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== 'light' && stored !== 'dark') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [applyTheme]);

  return { theme, toggleTheme, setTheme: applyTheme };
};
