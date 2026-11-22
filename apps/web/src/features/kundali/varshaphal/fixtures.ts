import type { VarshaphalResponse } from '@myvedicstar/contracts';

/**
 * Fixtures derived from the shipped Varshaphal contract only (ui#123).
 *
 * `varshaphalCapabilityGap` is the day-one truth: the engine has no Varshaphal, so the section has no chart to draw. It
 * carries no chart field at all — the schema has no optional one to leave half-filled.
 *
 * `varshaphalComputed` exists so the opposite branch is testable: without it, a component that rendered nothing ever would
 * pass every gap test. Its values are the engine's own notation, not numbers invented here.
 */
export const varshaphalCapabilityGap: VarshaphalResponse = {
  availability: 'unsupported',
  reason: 'engine-unavailable',
};

export const varshaphalComputed: VarshaphalResponse = {
  availability: 'computed',
  chart: {
    annualYear: 2083,
    annualAscendant: "Mesha 11°24'",
    values: [
      { path: 'varshaphal/annual/sun', value: "Simha 4°02'" },
      { path: 'varshaphal/annual/moon', value: "Vrishabha 19°51'" },
    ],
    withheld: [{ path: 'varshaphal/annual/lagna-minute', reason: 'birth-time-unknown' }],
    revision: 'rev-42',
  },
};
