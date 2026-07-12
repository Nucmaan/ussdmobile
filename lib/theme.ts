'use client';

import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'nasri-theme';

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Theme state persisted to localStorage; dark is the default. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? 'dark';
    setTheme(stored);
    apply(stored);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
