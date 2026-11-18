import { describe, expect, it } from 'vitest';

import { completenessOf, kundaliBalaSchema } from './kundali-bala';

/**
 * Contract guards for KUN-12, written against the merged API payload (aprraju/myvedicstar `4217930`).
 *
 * Each rejection below is a class of misreading the section must not allow: a placeholder rendered as a measurement,
 * a withheld component silently summed, a total claiming completeness it does not have.
 */

function planet(overrides: Record<string, unknown> = {}) {
  return {
    planet: 'Sun',
    components: { sthana: 1.4, dig: 0, kala: 1.8, naisargika: 0.4, drik: 0.1 },
    componentStates: {
      sthana: 'computed',
      dig: 'placeholder',
      kala: 'computed',
      naisargika: 'computed',
      drik: 'computed',
    },
    total: 3.7,
    requiredRupas: 5,
    ratioToThreshold: 0.74,
    componentsWithheld: ['chesta'],
    componentsInTotal: ['sthana', 'kala', 'naisargika', 'drik'],
    componentsExcludedFromTotal: ['dig', 'chesta'],
    ...overrides,
  };
}

function value(overrides: Record<string, unknown> = {}) {
  return {
    rulesVersion: 'shadbala-2024.1',
    unit: 'rupas',
    complete: false,
    shadbala: [planet()],
    bhavaBala: [{ house: 1, components: { sthana: 1.1 }, total: 1.1 }],
    unsupported: [{ path: 'shadbala.chesta', reason: 'rule-not-implemented' }],
    ...overrides,
  };
}

describe('KUN-12 bala contract', () => {
  it('accepts the merged payload shape', () => {
    expect(kundaliBalaSchema.safeParse(value()).success).toBe(true);
  });

  it('rejects a component that has a value but no state', () => {
    const result = kundaliBalaSchema.safeParse(
      value({
        shadbala: [
          planet({
            componentStates: {
              sthana: 'computed',
              kala: 'computed',
              naisargika: 'computed',
              drik: 'computed',
            },
          }),
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a placeholder component counted in the total', () => {
    // The whole point of componentStates: a zero by flag must not be summed as strength.
    const result = kundaliBalaSchema.safeParse(
      value({
        shadbala: [planet({ componentsInTotal: ['sthana', 'dig', 'kala', 'naisargika', 'drik'] })],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a component excluded from the total but marked computed', () => {
    const result = kundaliBalaSchema.safeParse(
      value({ shadbala: [planet({ componentsExcludedFromTotal: ['sthana'] })] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a component that contributes to the total but has no value', () => {
    const result = kundaliBalaSchema.safeParse(
      value({
        shadbala: [planet({ componentsInTotal: ['sthana', 'kala', 'naisargika', 'drik', 'gauravabala'] })],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a ratio with no required-rupas basis', () => {
    const result = kundaliBalaSchema.safeParse(value({ shadbala: [planet({ requiredRupas: undefined })] }));
    expect(result.success).toBe(false);
  });

  it('rejects a section that claims completeness while a planet total is short', () => {
    const result = kundaliBalaSchema.safeParse(value({ complete: true }));
    expect(result.success).toBe(false);
  });

  it('accepts a section that claims completeness when every total is complete', () => {
    const complete = planet({
      components: { sthana: 1.4, dig: 0.6, kala: 1.8, chesta: 0.9, naisargika: 0.4, drik: 0.1 },
      componentStates: {
        sthana: 'computed',
        dig: 'computed',
        kala: 'computed',
        chesta: 'computed',
        naisargika: 'computed',
        drik: 'computed',
      },
      componentsWithheld: [],
      componentsInTotal: ['sthana', 'dig', 'kala', 'chesta', 'naisargika', 'drik'],
      componentsExcludedFromTotal: [],
    });
    expect(
      kundaliBalaSchema.safeParse(value({ complete: true, shadbala: [complete], unsupported: [] })).success,
    ).toBe(true);
  });

  it('rejects two rows for the same planet', () => {
    const result = kundaliBalaSchema.safeParse(value({ shadbala: [planet(), planet()] }));
    expect(result.success).toBe(false);
  });

  it('rejects a state for a component that carries no value', () => {
    // chesta appears in componentsWithheld but is absent from `components`; naming it in `componentStates` claims a
    // state for a value that does not exist.
    const result = kundaliBalaSchema.safeParse(
      value({
        shadbala: [
          planet({
            componentStates: { ...planet().componentStates, chesta: 'withheld' },
            componentsInTotal: ['sthana', 'kala', 'naisargika', 'drik'],
          }),
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe('KUN-12 completeness derivation', () => {
  it('is partial when a classical component is not in the total', () => {
    const parsed = kundaliBalaSchema.parse(value());
    const completeness = completenessOf(parsed.shadbala[0]!);
    expect(completeness.kind).toBe('partial');
    // Dig is not in componentsInTotal either: a placeholder contributes no strength, so it is missing from the
    // total as surely as a withheld component is.
    expect(completeness.kind === 'partial' && completeness.missing).toEqual(['dig', 'chesta']);
  });

  it('is complete when every classical component is counted', () => {
    const parsed = kundaliBalaSchema.parse(
      value({
        complete: true,
        unsupported: [],
        shadbala: [
          planet({
            // Every classical component must carry a value for the state to be admissible, so the complete case
            // includes chesta in `components` (the base fixture withholds it).
            components: { sthana: 1.4, dig: 0.6, kala: 1.8, chesta: 0.9, naisargika: 0.4, drik: 0.1 },
            componentStates: {
              sthana: 'computed',
              dig: 'computed',
              kala: 'computed',
              chesta: 'computed',
              naisargika: 'computed',
              drik: 'computed',
            },
            componentsWithheld: [],
            componentsInTotal: ['sthana', 'dig', 'kala', 'chesta', 'naisargika', 'drik'],
            componentsExcludedFromTotal: [],
          }),
        ],
      }),
    );
    expect(completenessOf(parsed.shadbala[0]!).kind).toBe('complete');
  });
});
