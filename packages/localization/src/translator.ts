import { en } from './catalogs/en';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/** Shape every catalog follows; the English catalog is the source of truth. */
export type Messages = Widen<typeof en>;
export type PartialMessages = DeepPartial<Messages>;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
type StripPlural<K> = K extends `${infer Base}_one` | `${infer Base}_other` ? Base : K;

/** Every valid message key, e.g. `errors.network`. Checked at compile time. */
export type MessageKey = StripPlural<Paths<Messages>> & string;
export type MessageParams = Record<string, string | number>;

export interface Translator {
  readonly locale: string;
  t(key: MessageKey, params?: MessageParams): string;
  /** For keys that arrive at runtime (e.g. validation error codes); returns `fallback` when unknown. */
  tDynamic(key: string, params?: MessageParams, fallback?: string): string;
  has(key: string): boolean;
}

/**
 * Creates a translator for a locale. Missing entries fall back to English, so partially translated catalogs are safe.
 */
export function createTranslator(locale: string, catalog?: PartialMessages): Translator {
  // Hermes on Android (React Native) has no Intl.PluralRules, and may lack Intl.NumberFormat: fall back to the English
  // rule (1 → "one", else "other") and plain numbers there. Browsers and Node have both.
  const plural =
    typeof Intl.PluralRules === 'function'
      ? new Intl.PluralRules(locale)
      : { select: (count: number) => (count === 1 ? 'one' : 'other') };
  const number =
    typeof Intl.NumberFormat === 'function'
      ? new Intl.NumberFormat(locale)
      : { format: (value: number) => String(value) };

  const lookup = (key: string): string | undefined => {
    return resolve(catalog, key) ?? resolve(en, key);
  };

  const format = (template: string, params?: MessageParams) =>
    params
      ? template.replace(/\{(\w+)\}/g, (match, name: string) => {
          const value = params[name];
          if (value === undefined) return match;
          return typeof value === 'number' ? number.format(value) : value;
        })
      : template;

  const translate = (key: string, params?: MessageParams): string | undefined => {
    const count = params?.count;
    if (typeof count === 'number') {
      const pluralForm = lookup(`${key}_${plural.select(count)}`) ?? lookup(`${key}_other`);
      if (pluralForm !== undefined) return format(pluralForm, params);
    }
    const template = lookup(key);
    return template === undefined ? undefined : format(template, params);
  };

  return {
    locale,
    t: (key, params) => translate(key, params) ?? key,
    tDynamic: (key, params, fallback) => translate(key, params) ?? fallback ?? key,
    has: (key) => lookup(key) !== undefined,
  };
}

function resolve(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}
