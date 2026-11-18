import { z } from 'zod';

import { unsupportedEntrySchema } from './kundali-overview';

/**
 * KUN-09 dasha timeline contract.
 *
 * Binding shape from the architect refinement on aprraju/myvedicstar#19 and the implemented endpoint
 * `GET /api/v1/kundali/{profileId}/sections/dashas?system=&at=`:
 * `{ system, displayTimezone, moonLongitude?, at?, mahadashas[], periodPath[], unsupported[] }`.
 *
 * Four rules are load-bearing and are enforced here rather than by convention:
 *  - Every period bound is an absolute UTC instant (`startUtc`, `endUtc`). A dasha boundary is a moment, not a
 *    calendar day, so nothing in this contract is a date string a renderer could interpret in the device zone.
 *  - `displayTimezone` is REQUIRED. The caller never infers which zone to render the instants in, and the UI cannot
 *    silently fall back to the browser's zone.
 *  - `unsupported[]` carries localizable CODES, never prose. A system that exists but is not yet validated is a claim
 *    of its own ("computed but not proven"), distinct from "not built" and from "cannot know".
 *  - A period that has not been proven is ABSENT, not zero-length and not a placeholder pair. The path's
 *    `unsupported` entries explain the absence; the UI must not synthesise a period to fill the space.
 */

/**
 * The dasha systems the API knows. `vimshottari` is the default when the parameter is omitted. `yogini` returns its
 * own periods with no sub-levels; `chara` currently withholds its timeline with `unvalidated-reference`.
 */
export const dashaSystemValues = ['vimshottari', 'yogini', 'chara'] as const;
export const dashaSystemSchema = z.enum(dashaSystemValues);
export type DashaSystem = z.infer<typeof dashaSystemSchema>;

/**
 * One period in the timeline.
 *
 * `level` is sent by the server, not derived by the client: Vimshottari uses `mahadasha` / `antardasha` /
 * `pratyantardasha`, Yogini uses `Yogini`. Because it is a plain string the UI can render an unfamiliar level name
 * rather than silently mis-nesting a period it does not recognise.
 */
export const kundaliDashaPeriodSchema = z.object({
  /** The lord (planet) or, for Yogini, the yogini name. A display name chosen by the engine, not a code to map. */
  lord: z.string().min(1),
  /** `mahadasha`, `antardasha`, `pratyantardasha`, `Yogini` — engine vocabulary, shown as given. */
  level: z.string().min(1),
  /** Inclusive start, as a UTC instant with an offset. */
  startUtc: z.string().datetime({ offset: true }),
  /** Exclusive end, as a UTC instant with an offset. A boundary belongs to exactly one period (AC2). */
  endUtc: z.string().datetime({ offset: true }),
});
export type KundaliDashaPeriod = z.infer<typeof kundaliDashaPeriodSchema>;

export const kundaliDashaTimelineSchema = z.object({
  /** The system actually answered for, echoed so the response is never ambiguous about which one produced it. */
  system: z.string().min(1),
  /** IANA zone the instants should be rendered in. Required: see the section note. */
  displayTimezone: z.string().min(1),
  /**
   * The sidereal Moon longitude the starting lord was derived from. Published so the starting point can be checked
   * instead of trusted; absent when the engine could not produce it, never `0`.
   */
  moonLongitude: z.number().min(0).lt(360).optional(),
  /**
   * The instant the period path describes. The server echoes it (its own clock when `at` was omitted) so the client
   * never has to assume its clock matched the server's.
   */
  at: z.string().datetime({ offset: true }).optional(),
  /** Top-level periods in order. Empty when the system withholds its timeline; the reason is in `unsupported`. */
  mahadashas: z.array(kundaliDashaPeriodSchema),
  /**
   * The mahadasha/antardasha/pratyantardasha chain at `at`, outermost first. Empty rather than partial when the
   * instant is outside the generated span or the sub-levels are not implemented.
   */
  periodPath: z.array(kundaliDashaPeriodSchema),
  /** Why a block is missing. Paths are response property names, e.g. `PeriodPath`. */
  unsupported: z.array(unsupportedEntrySchema),
});
export type KundaliDashaTimeline = z.infer<typeof kundaliDashaTimelineSchema>;
