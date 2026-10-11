import { queryKeys } from '@myvedicstar/api-client';
import { traditionKeySchema } from '@myvedicstar/validation';
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { useAuth } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { preferenceStorage } from '../../shared/storage/preference-storage';

const STORAGE_KEY = 'tradition';

interface TraditionContextValue {
  /** Tradition key sent to the backend, e.g. `telugu`. Independent of location — never inferred from GPS. */
  tradition: string;
  setTradition(key: string): void;
}

const TraditionContext = createContext<TraditionContextValue | null>(null);

export function TraditionStateProvider({ children }: { children: ReactNode }) {
  const { config } = useServices();
  const [tradition, setState] = useState(
    () => preferenceStorage.read(STORAGE_KEY, traditionKeySchema) ?? config.defaultTradition,
  );
  const setTradition = useCallback((key: string) => {
    if (!traditionKeySchema.safeParse(key).success) return;
    setState(key);
    preferenceStorage.write(STORAGE_KEY, key);
  }, []);
  const value = useMemo(() => ({ tradition, setTradition }), [tradition, setTradition]);
  return <TraditionContext.Provider value={value}>{children}</TraditionContext.Provider>;
}

export function useTradition(): TraditionContextValue {
  const context = useContext(TraditionContext);
  if (!context) throw new Error('useTradition must be used inside <TraditionStateProvider>');
  return context;
}

/** The traditions the backend offers, in display order, in the UI language. Rarely changes: cached for a day. */
export function useTraditions() {
  const { isAuthenticated, loading } = useAuth();
  const { api } = useServices();
  const { language } = useTranslation();
  return useQuery({
    queryKey: queryKeys.traditions.list(language),
    queryFn: ({ signal }) => api.traditions.list(language, { signal }),
    staleTime: 24 * 60 * 60_000,
    enabled: isAuthenticated && !loading,
  });
}
