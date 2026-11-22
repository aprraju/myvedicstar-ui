import { z } from 'zod';

import { unsupportedReasonSchema } from './kundali-overview';
import { assessmentAvailabilitySchema } from './kundali-yogas';

/**
 * KUN-14 Varshaphal (annual chart) surface contract — the capability-gap half, ui#123.
 *
 * The engine has no Varshaphal: api#30 / KUN-20 is closed and never covered it, and the endpoint that exists returns
 * "annual chart facts" as a shape with no specified contents. Rendering that would mean inventing the values behind it,
 * which the client is forbidden to do. So this module defines exactly two things and nothing else:
 *
 *  1. a response shape that carries EITHER an annual chart with real, engine-produced values, OR an explicit
 *     capability gap with a reason code — never both, never neither;
 *  2. a `varshaphalState()` resolver whose `absent` branch is the day-one answer.
 *
 * What is deliberately NOT here, and why:
 *  - **No fallback computation.** There is no function that derives an annual ascendant, an annual position or a
 *    solar-return instant. Those are engine facts; a client-side approximation would be a wrong chart presented as a
 *    right one.
 *  - **No free-form "facts" bag.** An object of unknown keys is exactly the shape that invites a renderer to pick a
 *    plausible field and print it. The schema below is strict, so an unexpected key is a parse error.
 *  - **No default for a withheld value.** A withheld annual value is neither zero nor an omission; it carries a reason
 *    per item, matching the `{ path, reason }` shape used across Kundali.
 *
 * The type is strict on purpose: a payload the API could not have produced must fail to parse rather than degrade into
 * something the UI can draw. That property is asserted in the companion test — it is the issue's acceptance criterion.
 */

/** One annual value the engine actually produced. `path` is the engine's own address for the value, so a table row can
 *  be traced back to it rather than to a UI-invented label. */
export const varshaphalValueSchema = z
  .object({
    path: z.string().min(1),
    /** The engine's own notation for the value. Not parsed, not normalised, not rounded by the client. */
    value: z.string().min(1),
  })
  .strict();
export type VarshaphalValue = z.infer<typeof varshaphalValueSchema>;

/** One annual value the engine withheld, and why. A withheld value is a fact about the engine, not a missing row. */
export const varshaphalWithheldValueSchema = z
  .object({
    path: z.string().min(1),
    reason: unsupportedReasonSchema,
  })
  .strict();
export type VarshaphalWithheldValue = z.infer<typeof varshaphalWithheldValueSchema>;

/**
 * The annual chart as the engine would produce it.
 *
 * Every field is required and non-empty: a chart with no ascendant is not a chart, and `annualYear` is the only thing
 * that makes an annual chart annual. `revision` is required so this section is `freshnessOf`-comparable with every other
 * Kundali section instead of being the one payload that cannot be told stale.
 */
export const varshaphalChartSchema = z
  .object({
    /** The Hindu solar year this chart belongs to, as the engine computes it. */
    annualYear: z.number().int(),
    /** Annual ascendant, engine notation. */
    annualAscendant: z.string().min(1),
    values: z.array(varshaphalValueSchema).min(1),
    withheld: z.array(varshaphalWithheldValueSchema),
    revision: z.string().min(1),
  })
  .strict();
export type VarshaphalChart = z.infer<typeof varshaphalChartSchema>;

/**
 * The response, as a discriminated pair.
 *
 * `availability: 'computed'` carries the chart and nothing else. Every other availability carries a reason and NO chart
 * field at all — note there is no optional `chart` key to leave half-filled. A server that sends a chart alongside
 * `unsupported` fails the strict parse, because "we could not compute this" and "here is the result" cannot both be
 * true.
 */
export const varshaphalComputedResponseSchema = z
  .object({
    availability: z.literal('computed'),
    chart: varshaphalChartSchema,
  })
  .strict();

export const varshaphalGapResponseSchema = z
  .object({
    availability: assessmentAvailabilitySchema.exclude(['computed']),
    reason: unsupportedReasonSchema,
  })
  .strict();

export const varshaphalResponseSchema = z.discriminatedUnion('availability', [
  varshaphalComputedResponseSchema,
  varshaphalGapResponseSchema,
]);
export type VarshaphalResponse = z.infer<typeof varshaphalResponseSchema>;

/**
 * The grep marker `capability-gap-render` stays in this module so the UI shell's source guard has a stable anchor: a file
 * that imports from here is allowed to render the gap, and must not carry its own annual-chart arithmetic.
 */
/** How the surface should be drawn. Three members, and `capability-gap` is a real answer, not an empty chart. */
export type VarshaphalState =
  | { kind: 'chart'; chart: VarshaphalChart }
  | {
      kind: 'capability-gap';
      availability: Exclude<VarshaphalResponse['availability'], 'computed'>;
      reason: string;
    }
  /** No response yet: still loading, or the request failed. Carries nothing to render, on purpose. */
  | { kind: 'unavailable' };

/**
 * The single adapter from payload to renderable state.
 *
 * `undefined` (no response) and a gap response both produce states with no chart in them, so no caller can reach an
 * annual chart it was not given. There is no branch that synthesises one: the only way to obtain a `chart` state is a
 * payload whose `availability` is `computed` and whose chart passed the strict schema.
 */
export function varshaphalState(response: VarshaphalResponse | undefined | null): VarshaphalState {
  if (!response) return { kind: 'unavailable' };
  if (response.availability === 'computed') return { kind: 'chart', chart: response.chart };
  return { kind: 'capability-gap', availability: response.availability, reason: response.reason };
}
