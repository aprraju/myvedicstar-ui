/**
 * KUN-14 interpretations availability.
 *
 * The single switch for this section, following the pattern established by `reports/reportAvailability.ts`: a named
 * place you change when the API lands, rather than a condition buried in a component.
 *
 * There is deliberately NO branch here that returns `available: true`. Not as an oversight, and not as a placeholder
 * to be wired up later: the interpretations endpoint of the KUN-14 contract is not built, so there is nothing this
 * module could correctly be reading. A function with no `true` branch cannot be reading a gap in the server - it can
 * only be reporting a known absence. When the endpoint ships, this is the one file that changes.
 *
 * This is the SECOND availability switch in Kundali. That is a deliberate, named exception rather than a pattern to
 * copy: reports and interpretations are separate features against separate unbuilt endpoints, so one switch serving
 * both would be a fiction. Two files, each naming exactly one missing capability.
 */

/** The domains the KUN-14 contract defines. No other domain exists. */
export const interpretationDomainValues = [
  'career',
  'marriage',
  'wellbeing',
  'finance',
  'education',
] as const;
export type InterpretationDomain = (typeof interpretationDomainValues)[number];

/**
 * Per-section status. A local closed union because the API contract gives values without stating exhaustiveness.
 *
 * Recorded in INTERPRETATION_CONTRACT_GAPS rather than silently assumed. The three are genuinely different facts:
 *  - `ready`   - computed and returned;
 *  - `pending` - not yet computed; may become ready without anyone acting;
 *  - `failed`  - computed and did not succeed.
 *
 * `pending` must never render as `failed`. Collapsing them is the #50 error at the section level: it tells a reader
 * something is broken when it is merely unfinished, and the reader may act on it.
 */
export type InterpretationStatus = 'ready' | 'pending' | 'failed';

/**
 * What the contract does not yet provide. Data rather than prose, so it cannot go stale in a comment.
 *
 * SCOPE: this is the INTERPRETATION-blocking list. It is not a restatement of the whole KUN-14 contract, and it
 * excludes Varshaphal entirely - Varshaphal was split out because the engine has no annual-chart capability, so its
 * UI is blocked on engine work, not on this endpoint.
 */
const INTERPRETATION_CONTRACT_GAPS = [
  'endpoint-get-interpretations',
  'status-exhaustiveness',
  'failure-reason-code',
] as const;

type InterpretationContractGap = (typeof INTERPRETATION_CONTRACT_GAPS)[number];

export interface InterpretationAvailability {
  available: boolean;
  /** Present only when unavailable. Reuses the shared Kundali reason vocabulary rather than inventing a new one. */
  reason?: 'engine-unavailable';
  gaps: readonly InterpretationContractGap[];
}

/**
 * Whether the interpretations section can be used.
 *
 * Unconditionally unavailable: see the note above. A test asserts there is no path returning `available: true`, so a
 * future edit that quietly starts claiming availability fails rather than shipping.
 */
export function interpretationAvailability(): InterpretationAvailability {
  return {
    available: false,
    reason: 'engine-unavailable',
    gaps: INTERPRETATION_CONTRACT_GAPS,
  };
}
