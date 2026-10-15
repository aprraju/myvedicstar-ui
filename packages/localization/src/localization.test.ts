import { describe, expect, it } from 'vitest';

import { createTranslator, en, negotiateLanguage, type PartialMessages } from './index';

describe('createTranslator', () => {
  const t = createTranslator('en');

  it('resolves nested keys', () => {
    expect(t.t('nav.goodTime')).toBe('Good Time');
  });

  it('interpolates parameters and formats numbers for the locale', () => {
    // Years are identifiers, not quantities: pass them as strings so they are not grouped ("2,026").
    expect(t.t('footer.rights', { year: '2026' })).toBe('© 2026 MyVedicStar. All rights reserved.');
    const catalog = { states: { empty: '{count} results' } } as PartialMessages;
    expect(createTranslator('en-IN', catalog).t('states.empty', { count: 1234567 })).toBe(
      '12,34,567 results',
    );
  });

  it('falls back to English for missing translations', () => {
    const partial: PartialMessages = { nav: { today: 'ఈ రోజు' } };
    const te = createTranslator('te', partial);
    expect(te.t('nav.today')).toBe('ఈ రోజు');
    expect(te.t('nav.calendar')).toBe(en.nav.calendar);
  });

  it('selects plural forms with Intl.PluralRules', () => {
    const catalog = {
      states: { empty_one: '{count} item', empty_other: '{count} items' },
    } as unknown as PartialMessages;
    const plural = createTranslator('en', catalog);
    expect(plural.t('states.empty', { count: 1 })).toBe('1 item');
    expect(plural.t('states.empty', { count: 3 })).toBe('3 items');
  });

  it('translates runtime validation codes and falls back safely', () => {
    expect(t.tDynamic('validation.location.latitude.range')).toBe('Latitude must be between -90 and 90.');
    expect(t.tDynamic('validation.unknown.code', undefined, 'fallback')).toBe('fallback');
  });
});

describe('negotiateLanguage', () => {
  it('falls back to English while other catalogs are not yet available', () => {
    expect(negotiateLanguage(['te-IN', 'fr'])).toBe('en');
    expect(negotiateLanguage(['en-US'])).toBe('en');
  });
});
