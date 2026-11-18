import type { KundaliBala } from '@myvedicstar/contracts';

/**
 * Fixtures derived from the merged KUN-12 API contract (aprraju/myvedicstar `4217930`).
 *
 * `balaWithChestaWithheld` is the real day-one shape: the engine withholds Chesta, emits Dig as a placeholder zero
 * because the ascendant is not validated, and totals only the genuinely computed components. Dig is present in
 * `components` with the value 0 AND the state `placeholder`, which is exactly the case a naive renderer turns into a
 * computed zero.
 */

const withheldChesta = [{ path: 'shadbala.chesta', reason: 'rule-not-implemented' }];

/** The shipping shape: Chesta withheld, Dig placeholder, total partial by construction. */
export const balaWithChestaWithheld: KundaliBala = {
  rulesVersion: 'shadbala-2024.1',
  unit: 'rupas',
  complete: false,
  shadbala: [
    {
      planet: 'Sun',
      // Dig carries 0 because it is a placeholder, not because the Sun has no directional strength.
      components: { sthana: 1.42, dig: 0, kala: 1.88, naisargika: 0.42, drik: 0.15 },
      componentStates: {
        sthana: 'computed',
        dig: 'placeholder',
        kala: 'computed',
        naisargika: 'computed',
        drik: 'computed',
      },
      total: 3.87,
      requiredRupas: 5,
      ratioToThreshold: 0.774,
      componentsWithheld: ['chesta'],
      componentsInTotal: ['sthana', 'kala', 'naisargika', 'drik'],
      componentsExcludedFromTotal: ['dig', 'chesta'],
    },
  ],
  bhavaBala: [
    { house: 1, components: { sthana: 1.1, dig: 0.4 }, total: 1.5 },
    { house: 2, components: { sthana: 0.8, dig: 0.3 }, total: 1.1 },
  ],
  unsupported: withheldChesta,
};

/** A genuinely complete planet, to prove no caveat is printed when there is nothing to caveat. */
export const balaComplete: KundaliBala = {
  ...balaWithChestaWithheld,
  complete: true,
  shadbala: [
    {
      planet: 'Moon',
      components: { sthana: 1.5, dig: 0.9, kala: 1.2, chesta: 0.9, naisargika: 0.5, drik: 0.2 },
      componentStates: {
        sthana: 'computed',
        dig: 'computed',
        kala: 'computed',
        chesta: 'computed',
        naisargika: 'computed',
        drik: 'computed',
      },
      total: 5.2,
      requiredRupas: 5,
      ratioToThreshold: 1.04,
      componentsWithheld: [],
      componentsInTotal: ['sthana', 'dig', 'kala', 'chesta', 'naisargika', 'drik'],
      componentsExcludedFromTotal: [],
    },
  ],
  unsupported: [],
};

/** No required-rupas basis: no ratio is shown rather than a ratio of 1. */
const [sunWithChestaWithheld] = balaWithChestaWithheld.shadbala;
if (!sunWithChestaWithheld) throw new Error('fixture must contain the Sun row');

export const balaWithoutThreshold: KundaliBala = {
  ...balaWithChestaWithheld,
  shadbala: [{ ...sunWithChestaWithheld, requiredRupas: undefined, ratioToThreshold: undefined }],
};

/** A planet with no components at all: the section still renders, and says the breakdown is empty. */
export const balaEmptyPlanets: KundaliBala = {
  ...balaWithChestaWithheld,
  shadbala: [],
  bhavaBala: [],
  complete: false,
};

/** Every component withheld: the strongest form of \"this is not a Shadbala total\". */
export const balaAllWithheld: KundaliBala = {
  ...balaWithChestaWithheld,
  complete: false,
  shadbala: [
    {
      planet: 'Saturn',
      // Withheld components carry a shape value of 0 (never rendered): the contract requires every component that has
      // a value to have a state, which is precisely the guard that stops a shape zero being read as strength.
      components: { sthana: 0, dig: 0, kala: 0, chesta: 0, naisargika: 0, drik: 0 },
      componentStates: {
        sthana: 'withheld',
        dig: 'withheld',
        kala: 'withheld',
        chesta: 'withheld',
        naisargika: 'withheld',
        drik: 'withheld',
      },
      total: 0,
      componentsWithheld: ['sthana', 'dig', 'kala', 'chesta', 'naisargika', 'drik'],
      componentsInTotal: [],
      componentsExcludedFromTotal: ['sthana', 'dig', 'kala', 'chesta', 'naisargika', 'drik'],
    },
  ],
};
