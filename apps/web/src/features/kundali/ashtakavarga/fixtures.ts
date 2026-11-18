import type { KundaliAshtakavarga } from '@myvedicstar/contracts';

/**
 * Fixtures derived from the KUN-11 contract only.
 *
 * The engine does not compute Ashtakavarga yet, so the day-one fixture is `ashtakavargaRuleNotImplemented`: an
 * unsupported section with a reason code and NO numbers. There is deliberately no sample bindu table here - a
 * plausible-looking 12x7 grid of invented numbers is exactly the placeholder that reads as real data.
 */

/** Day one: no rule set, no values, an explicit reason. */
export const ashtakavargaRuleNotImplemented: KundaliAshtakavarga = {
  availability: 'unsupported',
  reason: 'rule-not-implemented',
};

/** The calculation service did not answer. */
export const ashtakavargaEngineUnavailable: KundaliAshtakavarga = {
  availability: 'unsupported',
  reason: 'engine-unavailable',
};

/**
 * A computed payload used only to prove that real values render without a redesign, and to exercise the accessible
 * table and heat map. The numbers are internally consistent arithmetically (the contract enforces reconciliation);
 * they are NOT reference fixtures and must never be presented as calculated Ashtakavarga.
 */
export const ashtakavargaComputed: KundaliAshtakavarga = {
  availability: 'computed',
  rulesVersion: 'ashtakavarga-2026.1',
  bhinna: [
    { planet: 'sun', bindus: [3, 4, 5, 6, 7, 8, 3, 4, 5, 6, 7, 2], total: 60 },
    { planet: 'moon', bindus: [4, 5, 6, 7, 8, 3, 4, 5, 6, 7, 2, 3], total: 60 },
    { planet: 'mars', bindus: [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 3], total: 50 },
    { planet: 'mercury', bindus: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], total: 36 },
    { planet: 'jupiter', bindus: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0], total: 55 },
    { planet: 'venus', bindus: [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5], total: 43 },
    { planet: 'saturn', bindus: [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4], total: 31 },
  ],
  sarva: [18, 23, 28, 33, 38, 37, 30, 21, 26, 31, 30, 20],
  totals: {
    perPlanet: { sun: 60, moon: 60, mars: 50, mercury: 36, jupiter: 55, venus: 43, saturn: 31 },
    grandTotal: 335,
  },
  legend: {
    version: 'ashtakavarga-2026.1',
    name: 'Sarvashtakavarga',
    note: 'Bindus per sign; a sign with 28 or more bindus is considered strong.',
  },
  weakSigns: ['aries', 'scorpio', 'pisces'],
};
