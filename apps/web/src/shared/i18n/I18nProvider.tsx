import {
  createTranslator,
  DEFAULT_LANGUAGE,
  loadCatalog,
  negotiateLanguage,
  type PartialMessages,
  plannedLanguages,
  type Translator,
} from '@myvedicstar/localization';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

interface I18nContextValue {
  translator: Translator;
  language: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Provides the UI translator. The language defaults to the browser's preferences; a user preference (Settings,
 * Phase 5) will override it. Panchang content language is requested from the backend separately.
 */
export function I18nProvider({ children, language: forced }: { children: ReactNode; language?: string }) {
  const language = forced ?? negotiateLanguage(navigator.languages ?? [navigator.language]);
  const [catalog, setCatalog] = useState<PartialMessages | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (language !== DEFAULT_LANGUAGE) {
      void loadCatalog(language).then((loaded) => {
        if (active) setCatalog(loaded);
      });
    }
    const info = plannedLanguages.find((l) => l.code === language);
    document.documentElement.lang = language;
    document.documentElement.dir = info?.direction ?? 'ltr';
    return () => {
      active = false;
    };
  }, [language]);

  const value = useMemo(
    () => ({ translator: createTranslator(language, catalog), language }),
    [language, catalog],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): Translator & { language: string } {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used inside <I18nProvider>');
  return { ...context.translator, language: context.language };
}

/**
 * The translator OBJECT, including `tDynamic` and `has`.
 *
 * `useTranslation` spreads the translator into a new object, which is convenient for `t` but loses the methods that are
 * needed to resolve a key built at runtime from server data (a dignity code, a planet identifier). `t` remains the
 * ordinary translate function for literal keys.
 */
export function useTranslator(): Translator {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslator must be used inside <I18nProvider>');
  return context.translator;
}
