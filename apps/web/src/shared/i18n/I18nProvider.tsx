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
