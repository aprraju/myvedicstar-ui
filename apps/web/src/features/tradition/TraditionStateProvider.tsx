import { queryKeys } from '@myvedicstar/api-client';
import { useAccountSettings } from '@myvedicstar/query-cache';
import { scopedKey } from '@myvedicstar/query-cache';
import { traditionKeySchema } from '@myvedicstar/validation';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { preferenceStorage } from '../../shared/storage/preference-storage';

const STORAGE_KEY = 'tradition';

interface TraditionContextValue {
  /** Tradition key sent to the backend, e.g. `telugu`. Independent of location — never inferred from GPS. */
  tradition: string;
  setTradition(key: string): void;
  applyDefault(key: string): void;
}

const TraditionContext = createContext<TraditionContextValue | null>(null);

export function TraditionStateProvider({ children }: { children: ReactNode }) {
  const { config, api } = useServices();
  const { user } = useAuth();
  const userId = user?.id;
  const { query: defaults } = useAccountSettings(api, userId);
  const applied = useRef<string | undefined>(undefined);
  const anonymous = useRef(
    preferenceStorage.read(STORAGE_KEY, traditionKeySchema) ?? config.defaultTradition,
  );
  const [tradition, setState] = useState(
    () => preferenceStorage.read(STORAGE_KEY, traditionKeySchema) ?? config.defaultTradition,
  );
  const setTradition = useCallback(
    (key: string) => {
      if (!traditionKeySchema.safeParse(key).success) return;
      setState(key);
      if (userId) {
        applied.current = userId;
        return;
      }
      anonymous.current = key;
      preferenceStorage.write(STORAGE_KEY, key);
    },
    [userId],
  );
  useEffect(() => {
    if (!userId) {
      if (applied.current) setState(anonymous.current);
      applied.current = undefined;
      return;
    }
    if (applied.current === userId || !defaults.isSuccess) return;
    applied.current = userId;
    if (defaults.data.defaultTradition) setState(defaults.data.defaultTradition);
  }, [userId, defaults.isSuccess, defaults.data]);
  const applyDefault = useCallback(
    (key: string) => {
      applied.current = userId;
      setState(key);
    },
    [userId],
  );
  const value = useMemo(
    () => ({ tradition, setTradition, applyDefault }),
    [tradition, setTradition, applyDefault],
  );
  return <TraditionContext.Provider value={value}>{children}</TraditionContext.Provider>;
}

export function useTradition(): TraditionContextValue {
  const context = useContext(TraditionContext);
  if (!context) throw new Error('useTradition must be used inside <TraditionStateProvider>');
  return context;
}

/** The traditions the backend offers, in display order, in the UI language. Rarely changes: cached for a day. */
export function useTraditions() {
  const { user, isAuthenticated, loading } = useAuth();
  const { api, config } = useServices();
  const { language } = useTranslation();
  return useQuery({
    queryKey: scopedKey(queryKeys.traditions.list(language), user?.id ?? null, config.cache),
    queryFn: ({ signal }) => api.traditions.list(language, { signal }),
    enabled: isAuthenticated && !loading,
  });
}
