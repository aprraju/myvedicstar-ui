import type { DivisionalChartResponse } from '@myvedicstar/contracts';

/** Contract-derived fixtures only: every field exists in the KUN-07 response shape. */

const nineHouses = [
  'Mesha',
  'Vrishabha',
  'Mithuna',
  'Karka',
  'Simha',
  'Kanya',
  'Tula',
  'Vrishchika',
  'Dhanu',
];

/** Day-one reality: the engine has not produced divisional positions, so precision says so and houses are empty. */
export const chartNotComputed: DivisionalChartResponse = {
  divisional: 'D9',
  method: 'D9',
  houses: [],
  precision: { status: 'approximate', reason: 'engine-unavailable' },
};

/** A reference chart: exactly nine houses, each carrying the sign and any placements. */
export const chartComputed: DivisionalChartResponse = {
  divisional: 'D9',
  method: 'D9',
  houses: nineHouses.map((sign, index) => ({
    sign,
    placements: index === 0 ? [{ planet: 'Chandra', sign, degree: 12.4 }] : [],
  })),
  precision: { status: 'computed' },
};

/** Positions exist but are unverified: drawable, with a visible caveat. */
export const chartUnvalidated: DivisionalChartResponse = {
  ...chartComputed,
  precision: { status: 'unvalidated-reference', reason: 'not-implemented' },
};
