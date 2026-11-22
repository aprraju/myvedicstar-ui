import { describe, expect, it } from 'vitest';

import type { KundaliPlanets } from './kundali-planets';
import { kundaliPlanetsSchema } from './kundali-planets';

/**
 * Requiredness asserted on the exported TYPE, one field at a time (issue #135).
 *
 * `KundaliPlanets = z.infer<typeof kundaliPlanetsSchema>` follows the schema, so the payload tests in
 * `kundali-planets.test.ts` can only prove what a *payload* does. They cannot see a field quietly becoming
 * `.optional()`: that weakens the type every consumer imports, while a payload that happens to carry the field keeps
 * satisfying them. `houseSystem` and `aspectMethod` going optional is exactly the AC2 regression this contract's own
 * header forbids — the UI would be able to render houses without the method that produced them, and every existing test
 * would stay green.
 *
 * Why this shape works: `RequiredKeysAreNotOptional` keeps a key only when its type does not admit `undefined`, so an
 * optional field drops out of the union. The `satisfies` witness below names every field individually, and tsc fails on
 * that line naming the dropped key — before any assertion runs, so no runtime stub can paper over it.
 */
type RequiredKeysAreNotOptional = {
  [K in keyof KundaliPlanets]-?: undefined extends KundaliPlanets[K] ? never : K;
}[keyof KundaliPlanets];

/**
 * The fields this contract requires, recorded as a decision rather than derived from key order.
 *
 * `planets` is here because the array itself is required even though an empty array is a valid answer: a section that
 * omits it entirely is not the same statement as one that found no rows. `conventions` is deliberately ABSENT — the
 * schema marks it optional, so an engine that does not publish its settings still produces a usable section, and the
 * provenance block is rendered only when it is there.
 */
const FIELDS_REQUIRED_BY_THE_CONTRACT = ['houseSystem', 'aspectMethod', 'planets'] as const;

describe('planets — the exported contract TYPE keeps every required field required', () => {
  it('accepts every contract key as a required key of the type, one explicitly-typed witness per field', () => {
    const witnesses = {
      houseSystem: true,
      aspectMethod: true,
      planets: true,
    } satisfies Record<RequiredKeysAreNotOptional, true>;

    // A field that became optional left the union above, so this comparison also catches the type fence drifting from
    // the list this file treats as the contract.
    expect(Object.keys(witnesses).sort()).toEqual([...FIELDS_REQUIRED_BY_THE_CONTRACT].sort());
  });

  it('keeps conventions optional on the type, so the witness above is a decision and not an accident', () => {
    // The negative half of the witness: a key the type allows to be absent must NOT be in the required union. If
    // `conventions` were ever made required, this assertion is what tells the next author to move it into the list
    // above instead of silently widening the check.
    const optionalByDesign = { conventions: true } satisfies Record<
      Exclude<keyof KundaliPlanets, RequiredKeysAreNotOptional>,
      true
    >;
    expect(Object.keys(optionalByDesign)).toEqual(['conventions']);
    expect(
      kundaliPlanetsSchema.safeParse({ houseSystem: 'whole-sign', aspectMethod: 'x', planets: [] }).success,
    ).toBe(true);
  });
});
