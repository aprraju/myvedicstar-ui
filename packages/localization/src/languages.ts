import { en } from './catalogs/en';
import type { PartialMessages } from './translator';

export interface LanguageInfo {
  /** BCP 47 tag, also sent to the backend as `language`. */
  code: string;
  /** Name in the language itself, for the language picker. */
  nativeName: string;
  englishName: string;
  direction: 'ltr' | 'rtl';
}

/**
 * Languages the product plans to support. A language is offered to users only once it has a UI catalog
 * (see {@link loadCatalog}) — the backend may support Panchang content in more languages than the UI chrome.
 */
export const plannedLanguages: readonly LanguageInfo[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', direction: 'ltr' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', direction: 'ltr' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', direction: 'ltr' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', direction: 'ltr' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', direction: 'ltr' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', direction: 'ltr' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', direction: 'ltr' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', direction: 'ltr' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', direction: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

/** Catalog loaders; each is a separate chunk on web so only the chosen language is downloaded. */
const catalogLoaders: Record<string, () => Promise<PartialMessages>> = {
  en: async () => en,
};

export const availableLanguages: readonly LanguageInfo[] = plannedLanguages.filter(
  (l) => l.code in catalogLoaders,
);

export async function loadCatalog(code: string): Promise<PartialMessages> {
  const loader = catalogLoaders[code] ?? catalogLoaders[DEFAULT_LANGUAGE];
  return loader ? loader() : en;
}

/** Picks the best available UI language from the user's preferences, e.g. `['te-IN', 'en-US']`. */
export function negotiateLanguage(preferred: readonly string[]): string {
  const available = new Set(availableLanguages.map((l) => l.code));
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base && available.has(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
