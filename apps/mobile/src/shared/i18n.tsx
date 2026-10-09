import { createTranslator, negotiateLanguage, type Translator } from '@myvedicstar/localization';
import { getLocales } from 'expo-localization';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

const I18nContext = createContext<Translator | null>(null);

/** UI translator for the device's preferred languages (falls back to English). */
export function I18nProvider({ children, language }: { children: ReactNode; language?: string }) {
  const value = useMemo(() => {
    const code = language ?? negotiateLanguage(getLocales().map((l) => l.languageTag));
    return createTranslator(code);
  }, [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): Translator {
  const translator = useContext(I18nContext);
  if (!translator) throw new Error('useTranslation must be used inside <I18nProvider>');
  return translator;
}
