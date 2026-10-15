import { describe, expect, it } from 'vitest';

import {
  contactFormSchema,
  coordinatesFormSchema,
  dateRangeSchema,
  localDateSchema,
  loginHintFormSchema,
  parseLocationInput,
} from './index';

describe('parseLocationInput', () => {
  it.each([
    ['Austin', ['Austin']],
    ['Austin, TX', ['Austin', 'TX']],
    ['Austin, TX, USA', ['Austin', 'TX', 'USA']],
    ['Hyderabad, Telangana, India', ['Hyderabad', 'Telangana', 'India']],
    ['São Paulo', ['São Paulo']],
    ['హైదరాబాదు', ['హైదరాబాదు']],
  ])('classifies "%s" as a place', (input, parts) => {
    const result = parseLocationInput(input);
    expect(result).toEqual({ ok: true, value: { kind: 'place', place: parts.join(', '), parts } });
  });

  it.each(['78701', '560001', 'SW1A 1AA', '10115'])('classifies "%s" as a postal code', (input) => {
    const result = parseLocationInput(input);
    expect(result.ok && result.value.kind).toBe('postalCode');
  });

  it.each([
    ['30.2672, -97.7431', 30.2672, -97.7431],
    ['17.385 78.4867', 17.385, 78.4867],
    ['-33.8688,151.2093', -33.8688, 151.2093],
  ])('classifies "%s" as coordinates', (input, latitude, longitude) => {
    expect(parseLocationInput(input)).toEqual({
      ok: true,
      value: { kind: 'coordinates', latitude, longitude },
    });
  });

  it('rejects latitude outside -90..90', () => {
    expect(parseLocationInput('95, 10')).toEqual({ ok: false, error: 'location.latitude.range' });
  });

  it('rejects longitude outside -180..180', () => {
    expect(parseLocationInput('10, 181')).toEqual({ ok: false, error: 'location.longitude.range' });
  });

  it('rejects empty input', () => {
    expect(parseLocationInput('   ')).toEqual({ ok: false, error: 'location.input.required' });
  });

  it('rejects markup and scripts', () => {
    expect(parseLocationInput('<script>alert(1)</script>')).toEqual({
      ok: false,
      error: 'location.place.invalidCharacters',
    });
  });

  it('rejects input longer than the backend limit', () => {
    expect(parseLocationInput('a'.repeat(121))).toEqual({ ok: false, error: 'location.place.tooLong' });
  });

  it('rejects more than city, state, country', () => {
    expect(parseLocationInput('A, B, C, D')).toEqual({ ok: false, error: 'location.place.format' });
  });
});

describe('coordinatesFormSchema', () => {
  it('parses string inputs into numbers', () => {
    expect(coordinatesFormSchema.parse({ latitude: ' 30.2672 ', longitude: '-97.7431' })).toEqual({
      latitude: 30.2672,
      longitude: -97.7431,
    });
  });

  it('reports each invalid field with a localization key', () => {
    const result = coordinatesFormSchema.safeParse({ latitude: 'abc', longitude: '200' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['latitude', 'location.latitude.invalid'],
      ['longitude', 'location.longitude.range'],
    ]);
  });
});

describe('dates', () => {
  it('accepts dates in the backend range', () => {
    expect(localDateSchema.safeParse('2026-09-29').success).toBe(true);
    expect(localDateSchema.safeParse('2101-01-01').success).toBe(false);
    expect(localDateSchema.safeParse('2026-02-30').success).toBe(false);
  });

  it('requires start on or before end', () => {
    expect(dateRangeSchema.safeParse({ start: '2026-10-02', end: '2026-10-01' }).success).toBe(false);
  });
});

describe('loginHintFormSchema', () => {
  it('accepts an empty or valid email', () => {
    expect(loginHintFormSchema.safeParse({ email: '' }).success).toBe(true);
    expect(loginHintFormSchema.parse({ email: ' name@example.com ' })).toEqual({ email: 'name@example.com' });
  });

  it('rejects malformed or overlong emails with a localization key', () => {
    const result = loginHintFormSchema.safeParse({ email: 'not-an-email' });
    expect(result.error?.issues[0]?.message).toBe('email.invalid');
    expect(loginHintFormSchema.safeParse({ email: `${'a'.repeat(250)}@x.io` }).success).toBe(false);
  });
});

describe('contactFormSchema', () => {
  const valid = {
    name: ' Asha ',
    email: 'asha@example.com',
    reason: 'technical',
    subject: 'Calendar question',
    phoneNumber: '',
    message: 'The calendar looks wrong.',
  };

  it('accepts a complete form and trims text', () => {
    const result = contactFormSchema.safeParse(valid);
    expect(result.success && result.data.name).toBe('Asha');
  });

  it.each([
    [{ name: '' }, 'contact.nameRequired'],
    [{ name: 'x'.repeat(101) }, 'contact.nameTooLong'],
    [{ email: 'not-an-email' }, 'email.invalid'],
    [{ reason: 'spam' }, 'contact.reasonRequired'],
    [{ reason: '' }, 'contact.reasonRequired'],
    [{ message: 'too short' }, 'contact.messageTooShort'],
    [{ message: 'x'.repeat(2001) }, 'contact.messageTooLong'],
  ])('rejects %o with %s', (override, message) => {
    const result = contactFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(message);
  });
});
