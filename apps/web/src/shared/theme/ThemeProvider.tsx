import { type Appearance, appearanceSchema } from '@myvedicstar/validation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { preferenceStorage } from '../storage/preference-storage';

const STORAGE_KEY = 'appearance';

interface ThemeContextValue {
  appearance: Appearance;
  setAppearance(appearance: Appearance): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Light / Dark / System. "System" follows `prefers-color-scheme` purely in CSS (tokens.css), so there is no flash and
 * no inline script (CSP). An explicit choice sets `data-theme` on <html>.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState<Appearance>(
    () => preferenceStorage.read(STORAGE_KEY, appearanceSchema) ?? 'system',
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (appearance === 'system') delete root.dataset.theme;
    else root.dataset.theme = appearance;
  }, [appearance]);

  const setAppearance = useCallback((next: Appearance) => {
    setState(next);
    preferenceStorage.write(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppearance(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppearance must be used inside <ThemeProvider>');
  return context;
}
