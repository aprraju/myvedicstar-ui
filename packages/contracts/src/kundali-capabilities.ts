import { z } from 'zod';

/**
 * KUN-20 capability boundary contract (UI issue #111).
 *
 * Binding shape from the LIVE API: `KundaliCapabilitiesResponse` in
 * `src/MyVedicStar.Kundali.Api/Contracts/KundaliContracts.cs`, backed by
 * `MyVedicStar.Kundali.Shared/KundaliCapabilities.cs` (ADR-0016 section 3).
 *
 * Why this exists in the UI at all: every Kundali section previously hardcoded its own idea of what the engine can do,
 * and those assumptions drift. The Shadbala section assumed Chesta Bala was available; it is not. Nothing would have
 * caught the next one. One fetched boundary, rendered where sections are chosen, removes that class of drift.
 *
 * The load-bearing rule is that support is a THREE-way state, not a boolean:
 *  - **supported**   — a definitive fact.
 *  - **provisional** — returned, but only with a boundary distance; not asserted as definitive. D60 is the case: a
 *                      half-degree cut needing arc-second Lagna accuracy.
 *  - **absent**      — not produced at all.
 *
 * Collapsing provisional into "supported" overstates accuracy; collapsing it into "absent" withholds a real result.
 * `capabilityState` below is the single place that decision is made, and it is a discriminated result rather than a
 * pair of booleans precisely so that no caller can express "supported but maybe not" by accident.
 */

/** The exact field set the API sends. No field is invented, and none is optional: a partial capability report is worse
 *  than none, because it invites the caller to fill the gaps with assumptions. */
export const kundaliCapabilitiesSchema = z.object({
  /** Divisions whose mapping rule is implemented and validated. */
  supportedDivisionalCharts: z.array(z.number().int().positive()),
  /** Divisions returned only provisionally, with a boundary distance. A subset relationship with the above is NOT
   *  enforced here — the API is the authority on its own lists, and silently "fixing" an overlap would hide a real
   *  disagreement rather than surface it. */
  provisionalDivisionalCharts: z.array(z.number().int().positive()),
  supportedShadbalaComponents: z.array(z.string().min(1)),
  unsupportedShadbalaComponents: z.array(z.string().min(1)),
  /** e.g. `MeanNode`. */
  lunarNodeConvention: z.string().min(1),
  /** e.g. `GeocentricTrueSidereal`. */
  ascendantConvention: z.string().min(1),
  /** `YYYY-MM-DD`. Instants outside this range are refused by the engine, not extrapolated. */
  minimumSupportedBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maximumSupportedBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Human-readable caveats published alongside the structured boundary. Shown as provenance, never parsed. */
  unsupportedCapabilities: z.array(z.string().min(1)),
});
export type KundaliCapabilities = z.infer<typeof kundaliCapabilitiesSchema>;

/** How one capability is reported. Three members, not two, and not a boolean pair. */
export type CapabilityState = { kind: 'supported' } | { kind: 'provisional' } | { kind: 'absent' };

/**
 * Resolves one divisional chart's state from the payload.
 *
 * Precedence: a division in BOTH lists is treated as provisional, never supported. The API should not send that, but if
 * it does, the safe reading is the weaker claim — presenting a provisional result as definitive is the specific failure
 * this issue exists to prevent, and the loss from the other direction is merely caution.
 *
 * A division in neither list is `absent`. There is deliberately no fallback: "if missing then assume supported" is
 * exactly the client-side derivation the issue forbids.
 */
export function divisionalState(capabilities: KundaliCapabilities, divisions: number): CapabilityState {
  if (capabilities.provisionalDivisionalCharts.includes(divisions)) return { kind: 'provisional' };
  if (capabilities.supportedDivisionalCharts.includes(divisions)) return { kind: 'supported' };
  return { kind: 'absent' };
}

/** The same three-way reading for a Shadbala component. Absent is not zero and is never rendered as one. */
export function shadbalaState(capabilities: KundaliCapabilities, component: string): CapabilityState {
  if (capabilities.unsupportedShadbalaComponents.includes(component)) return { kind: 'absent' };
  if (capabilities.supportedShadbalaComponents.includes(component)) return { kind: 'supported' };
  // Not listed either way: the UI does not know, and saying "supported" would be an assumption. Absent is the honest
  // reading of "the boundary does not claim this".
  return { kind: 'absent' };
}

/** Divisions the payload declares provisional, in ascending order, for rendering. */
export function provisionalDivisions(capabilities: KundaliCapabilities): readonly number[] {
  return [...capabilities.provisionalDivisionalCharts].sort((a, b) => a - b);
}

/** Divisions the payload declares supported, in ascending order, excluding any that are also provisional. */
export function supportedDivisions(capabilities: KundaliCapabilities): readonly number[] {
  return capabilities.supportedDivisionalCharts
    .filter((divisions) => !capabilities.provisionalDivisionalCharts.includes(divisions))
    .sort((a, b) => a - b);
}
