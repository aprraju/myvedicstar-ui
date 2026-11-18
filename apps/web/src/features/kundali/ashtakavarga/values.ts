import {
  type AshtakavargaPlanet,
  type KundaliAshtakavarga,
  type Sign,
  signOrder,
} from '@myvedicstar/contracts';

/**
 * View model for a computed Ashtakavarga payload.
 *
 * This is a reshaping of the response - planet order, sign order, the sarva row - and nothing more. It performs no
 * arithmetic: totals come from the payload, and the reconciliation check that makes them trustworthy lives in the
 * contract schema (which rejects a payload that does not add up before it ever reaches this module).
 */
export interface AshtakavargaValues {
  signs: readonly Sign[];
  planets: readonly AshtakavargaPlanet[];
  bhinna: Record<AshtakavargaPlanet, readonly number[]>;
  sarva: readonly number[];
  perPlanet: Record<AshtakavargaPlanet, number>;
  grandTotal: number;
  maxBindu: number;
  weakSigns: readonly Sign[];
}

const planetOrder: AshtakavargaPlanet[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

/** Returns the view model, or null when the payload is not a fully computed one. Never fabricates a partial one. */
export function toValues(payload: KundaliAshtakavarga): AshtakavargaValues | null {
  const { bhinna, sarva, totals } = payload;
  if (payload.availability !== 'computed' || !bhinna || !sarva || !totals) return null;

  const order = planetOrder.filter((planet) => bhinna.some((row) => row.planet === planet));
  const bindus = {} as Record<AshtakavargaPlanet, readonly number[]>;
  const perPlanet = {} as Record<AshtakavargaPlanet, number>;
  for (const row of bhinna) {
    bindus[row.planet] = row.bindus;
    perPlanet[row.planet] = row.total;
  }

  // The maximum drives the heat scale. It is a property of the numbers returned, not a rule-set threshold.
  const maxBindu = Math.max(...bhinna.flatMap((row) => row.bindus), 0);

  return {
    signs: signOrder,
    planets: order,
    bhinna: bindus,
    sarva,
    perPlanet,
    grandTotal: totals.grandTotal,
    maxBindu,
    weakSigns: payload.weakSigns ?? [],
  };
}

export function bhinnaRows(values: AshtakavargaValues) {
  return values.planets.map((planet) => ({
    planet,
    bindus: values.bhinna[planet],
    total: values.perPlanet[planet],
  }));
}

export function sarvaRow(values: AshtakavargaValues) {
  return values.sarva;
}
