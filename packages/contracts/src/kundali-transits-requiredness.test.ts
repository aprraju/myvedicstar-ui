import { describe, expect, it } from 'vitest';

import type { KundaliTransitsSection } from './kundali-transits';

/**
 * Requiredness asserted on the exported TYPE, one field at a time (issue #135).
 *
 * The Sade Sati half of this contract is where an optional field is dangerous: the schema's own note says `isPartial`
 * is REQUIRED because a truncated observation must be represented as truncated. If that field went `.optional()` in the
 * schema, `KundaliTransitsSection` would inherit it, a payload carrying the field would still satisfy every existing
 * payload test, and the UI could print a boundary the engine never saw.
 *
 * Same idiom as `kundali-capabilities` (#143): the mapped type keeps only keys that cannot be `undefined`, and a
 * per-field `satisfies` witness makes the check part of the typecheck rather than a value comparison.
 */
type RequiredKeysAreNotOptional = {
  [K in keyof KundaliTransitsSection]-?: undefined extends KundaliTransitsSection[K] ? never : K;
}[keyof KundaliTransitsSection];

/**
 * Every top-level field of the section is required, and the three freshness instants plus the two nullable grahas are
 * the reason: an undated value, or a section that simply omits Saturn, is a different statement from one that says
 * "Saturn is not observable for this profile" with `null`.
 */
const FIELDS_REQUIRED_BY_THE_CONTRACT = [
  'referenceInstant',
  'timezone',
  'computedAt',
  'expiresAt',
  'saturn',
  'jupiter',
  'sadeSati',
  'datedTransits',
  'unsupported',
] as const;

describe('transits — the exported contract TYPE keeps every required field required', () => {
  it('accepts every contract key as a required key of the type, one explicitly-typed witness per field', () => {
    const witnesses = {
      referenceInstant: true,
      timezone: true,
      computedAt: true,
      expiresAt: true,
      saturn: true,
      jupiter: true,
      sadeSati: true,
      datedTransits: true,
      unsupported: true,
    } satisfies Record<RequiredKeysAreNotOptional, true>;

    expect(Object.keys(witnesses).sort()).toEqual([...FIELDS_REQUIRED_BY_THE_CONTRACT].sort());
  });

  it('does not treat nullable as optional: a null graha still has to be typed as present', () => {
    // The distinction this test exists for. `saturn` may be `null` — the value says "not observable" — but the KEY is
    // not allowed to be absent, which is what the witness above asserts. `undefined extends T` is the correct probe and
    // not `null extends T`: a key typed exactly `Graha | null` rejects `undefined` and stays in the required union,
    // whereas probing with `null` would say "false" for a key that has already become optional. Both halves are named
    // here so the reasoning cannot drift back to the wrong probe.
    const nullIsNotUndefined: undefined extends KundaliTransitsSection['saturn'] ? false : true = true;
    const optionalWouldLeaveTheUnion: 'saturn' extends RequiredKeysAreNotOptional ? true : false = true;
    expect(nullIsNotUndefined).toBe(true);
    expect(optionalWouldLeaveTheUnion).toBe(true);
  });
});
