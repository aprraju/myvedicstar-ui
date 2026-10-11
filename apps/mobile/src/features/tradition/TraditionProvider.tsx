import Ionicons from '@expo/vector-icons/Ionicons';
import { queryKeys } from '@myvedicstar/api-client';
import { scopedKey } from '@myvedicstar/query-cache';
import { traditionKeySchema } from '@myvedicstar/validation';
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '../../shared/auth';
import { AppText, Notice, Sheet } from '../../shared/components';
import { useTranslation } from '../../shared/i18n';
import { useServices } from '../../shared/services';
import { preferenceStorage } from '../../shared/storage';
import { useTheme } from '../../shared/theme';

const STORAGE_KEY = 'tradition';

interface TraditionContextValue {
  /** Tradition key sent to the backend. Independent of location — never inferred from GPS. */
  tradition: string;
  setTradition(key: string): void;
}

const TraditionContext = createContext<TraditionContextValue | null>(null);

export function TraditionProvider({ children }: { children: ReactNode }) {
  const { config } = useServices();
  const [tradition, setState] = useState(config.defaultTradition);

  useEffect(() => {
    void preferenceStorage
      .read(STORAGE_KEY, (v) => {
        const parsed = traditionKeySchema.safeParse(v);
        return parsed.success ? parsed.data : undefined;
      })
      .then((stored) => stored && setState(stored));
  }, []);

  const setTradition = useCallback((key: string) => {
    if (!traditionKeySchema.safeParse(key).success) return;
    setState(key);
    void preferenceStorage.write(STORAGE_KEY, key);
  }, []);

  const value = useMemo(() => ({ tradition, setTradition }), [tradition, setTradition]);
  return <TraditionContext.Provider value={value}>{children}</TraditionContext.Provider>;
}

export function useTradition(): TraditionContextValue {
  const context = useContext(TraditionContext);
  if (!context) throw new Error('useTradition must be used inside <TraditionProvider>');
  return context;
}

export function useTraditions() {
  const { user, isAuthenticated, loading } = useAuth();
  const { api, config } = useServices();
  const { locale } = useTranslation();
  const language = locale.split('-')[0];
  return useQuery({
    queryKey: scopedKey(queryKeys.traditions.list(language), user?.id ?? null, config.cache),
    queryFn: ({ signal }) => api.traditions.list(language, { signal }),
    enabled: isAuthenticated && !loading,
  });
}

/** Compact control showing the tradition; opens a sheet with the backend's list as radio options. */
export function TraditionPicker() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { tradition, setTradition } = useTradition();
  const { data, isError } = useTraditions();
  const [open, setOpen] = useState(false);
  const current = data?.traditions.find((item) => item.key === tradition)?.name ?? tradition;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('tradition.label')}: ${current}`}
        accessibilityHint={t('tradition.hint')}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          {
            minHeight: theme.touchTarget.minimum,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Ionicons name="book-outline" size={18} color={theme.colors.primary} />
        <AppText numberOfLines={1} style={{ color: theme.colors.primary }}>
          {current}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={theme.colors.primary} />
      </Pressable>
      <Sheet visible={open} title={t('tradition.label')} onClose={() => setOpen(false)}>
        <AppText variant="secondary">{t('tradition.hint')}</AppText>
        {isError && <Notice tone="error">{t('tradition.loadFailed')}</Notice>}
        <View accessibilityRole="radiogroup">
          {(data?.traditions ?? []).map((item) => {
            const selected = item.key === tradition;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  setTradition(item.key);
                  setOpen(false);
                }}
                style={[
                  styles.option,
                  { minHeight: theme.touchTarget.comfortable, borderColor: theme.colors.border },
                ]}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={theme.colors.primary}
                />
                <View style={styles.optionText}>
                  <AppText variant="heading">{item.name}</AppText>
                  {item.description && <AppText variant="secondary">{item.description}</AppText>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { flex: 1 },
});
