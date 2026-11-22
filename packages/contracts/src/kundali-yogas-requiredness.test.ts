import { describe, expect, it } from 'vitest';

import type { KundaliYogas } from './kundali-yogas';

/**
 * Requiredness asserted on the exported TYPE, one field at a time (issue #135).
 *
 * `kundaliYogasSchema` builds its type through `.superRefine(...)`, which is precisely the construction that hides an
 * `.optional()`: the refinement keeps the object shape, so a field going optional changes the inferred type without
 * changing anything this file's payload tests exercise. The section-level `availability` and `reason` pair is the
 * load-bearing case — the refinement requires a reason when the section is not computed, and an `availability` that
 * could be absent would leave the UI guessing which half of the payload to believe.
 *
 * Same idiom as `kundali-capabilities` (#143).
 */
type RequiredKeysAreNotOptional = {
  [K in keyof KundaliYogas]-?: undefined extends KundaliYogas[K] ? never : K;
}[keyof KundaliYogas];

/**
 * `availability` is required; `reason` is NOT in this list on purpose — the schema marks it optional and the
 * refinement enforces when it must appear, which is a conditional requirement rather than a type-level one. The other
 * four fields are required: an omitted `assessments` array is "no rows were evaluated", which is a different statement
 * from "the section could not be evaluated".
 */
const FIELDS_REQUIRED_BY_THE_CONTRACT = [
  'availability',
  'assessments',
  'families',
  'ruleSetVersions',
] as const;

describe('yogas — the exported contract TYPE keeps every required field required', () => {
  it('accepts every contract key as a required key of the type, one explicitly-typed witness per field', () => {
    const witnesses = {
      availability: true,
      assessments: true,
      families: true,
      ruleSetVersions: true,
    } satisfies Record<RequiredKeysAreNotOptional, true>;

    expect(Object.keys(witnesses).sort()).toEqual([...FIELDS_REQUIRED_BY_THE_CONTRACT].sort());
  });

  it('keeps reason optional on the type, because its requirement is conditional and lives in the refinement', () => {
    // If `reason` were moved into the required union by a schema change, this line stops compiling — a forced review
    // of whether the refinement's conditional rule was replaced by a blanket one.
    const optionalByDesign = { reason: true } satisfies Record<
      Exclude<keyof KundaliYogas, RequiredKeysAreNotOptional>,
      true
    >;
    expect(Object.keys(optionalByDesign)).toEqual(['reason']);
  });
});
