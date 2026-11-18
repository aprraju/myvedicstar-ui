import type { PlanetDetail, UnsupportedReason } from '@myvedicstar/contracts';

/**
 * Resolution of one cell of the planetary detail table.
 *
 * This is the KUN-08 load-bearing type, and it is deliberately a discriminated union rather than `string | undefined`.
 * An `unavailable` cell carries a reason and NO value field, so there is no shape in which a dash, a zero, an empty
 * table cell or an assumed default can be passed to the renderer. "We agree not to print a placeholder" becomes "a
 * placeholder cannot be constructed".
 */
export type CellView<T> = { kind: 'value'; value: T } | { kind: 'unavailable'; reason: UnsupportedReason };

/**
 * Resolves one planet-relative fact.
 *
 * Availability is decided by the payload alone: the fact renders when it is present. When it is absent, the reason
 * comes from the planet's own `unsupported` entry for that path; a missing fact with no matching entry falls back to
 * `engine-unavailable`, which is the honest default — the UI never invents a more specific excuse, and never omits the
 * cell so the row silently looks complete.
 */
export function resolveCell<T>(planet: PlanetDetail, path: string, fact: T | undefined): CellView<T> {
  if (fact !== undefined) {
    return { kind: 'value', value: fact };
  }
  return { kind: 'unavailable', reason: reasonFor(planet, path) };
}

export function reasonFor(planet: PlanetDetail, path: string): UnsupportedReason {
  return planet.unsupported.find((entry) => entry.path === path)?.reason ?? 'engine-unavailable';
}
