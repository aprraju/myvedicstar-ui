import { z } from 'zod';

import { assessmentAvailabilitySchema, assessmentReasonSchema } from './kundali-yogas';

/**
 * KUN-11 Ashtakavarga contract.
 *
 * Binding shape from the architect (2026-11-17):
 *   `GET /api/v1/kundali/{profileId}/sections/ashtakavarga` →
 *   { rulesVersion, bhinna[planet][12 sign bindus], sarva[12 sign totals], totals[perPlanet, grandTotal] }
 *
 * Load-bearing rules:
 *  - Twelve signs, in the fixed order `signOrder` below, positions 1..12 from Aries. The array length IS the contract:
 *    a short array is rejected here so the UI can never draw eleven bars and call it a chart.
 *  - The aggregate is a calculation fact, not a UI one: the sum of the per-planet bindus in a sign must equal the
 *    sarva total for that sign. A mismatch is rejected at the contract boundary as `reconciliation-failed` and never
 *    "repaired" by the client, because silently recomputing would publish a number the engine did not produce.
 *  - Values are bindus (small non-negative integers). No client-side interpolation, averaging or normalisation: the
 *    heat map is a colour mapping of the number the engine returned and nothing else.
 *  - Unsupported is a first-class state carried by the section, not an empty chart.
 */

/** Planets that have a Bhinnashtakavarga. The seven classical grahas; Rahu/Ketu have no classical bindu tables. */
export const ashtakavargaPlanetValues = [
  'sun',
  'moon',
  'mars',
  'mercury',
  'jupiter',
  'venus',
  'saturn',
] as const;
export const ashtakavargaPlanetSchema = z.enum(ashtakavargaPlanetValues);
export type AshtakavargaPlanet = z.infer<typeof ashtakavargaPlanetSchema>;

/** Fixed sign order, index 0 = the 1st sign of the zodiac (Aries). Shared by bhinna rows and the sarva row. */
export const signOrder = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;
export const signSchema = z.enum(signOrder);
export type Sign = z.infer<typeof signSchema>;

const BINDUS_PER_SIGN = signOrder.length;

/** A bindu count: a small non-negative integer. Bounded so a corrupt number cannot be charted as a real value. */
const bindu = z.number().int().min(0).max(64);

/**
 * Exactly twelve values, one per sign, in `signOrder`.
 *
 * `.length(...)` is enforced here rather than left to the renderer: the accessible table and the visualisation both
 * read this array by index, so a missing element would otherwise shift every later sign by one position.
 */
const signValues = z.array(bindu).length(BINDUS_PER_SIGN);

/** Per-planet Bhinnashtakavarga: twelve sign-wise bindu counts plus the planet's total. */
export const bhinnaRowSchema = z.object({
  planet: ashtakavargaPlanetSchema,
  bindus: signValues,
  /** Sum of `bindus` as the engine reported it. Cross-checked against the array in `kundaliAshtakavargaSchema`. */
  total: z.number().int().min(0),
});
export type BhinnaRow = z.infer<typeof bhinnaRowSchema>;

/**
 * How to read the values: the bindu contribution rule system the engine used. `name` and `note` are rule-set data
 * displayed verbatim; `version` is what a report cites.
 */
export const ashtakavargaLegendSchema = z.object({
  version: z.string().min(1),
  /** e.g. "Sarvashtakavarga", the aggregate the table totals to. */
  name: z.string().min(1),
  /** Methodology note from the rule set, e.g. how many bindus a sign needs to be considered strong. */
  note: z.string().min(1).optional(),
});
export type AshtakavargaLegend = z.infer<typeof ashtakavargaLegendSchema>;

export const kundaliAshtakavargaSchema = z
  .object({
    /** Section-level availability. `unsupported` with a reason is the day-one state. */
    availability: assessmentAvailabilitySchema,
    /** Present when `availability` is not 'computed'. */
    reason: assessmentReasonSchema.optional(),
    /** Present only when `availability` is 'computed'. */
    rulesVersion: z.string().min(1).optional(),
    /** Present only when `availability` is 'computed'; one row per supported planet, all twelve sign values. */
    bhinna: z.array(bhinnaRowSchema).optional(),
    /** Aggregate across planets: twelve sign totals summing all bhinna rows. */
    sarva: signValues.optional(),
    /** Printed totals, so the UI shows the engine's number rather than re-deriving it. */
    totals: z
      .object({
        // Partial by design: the engine reports totals only for the planets it evaluated, and a missing entry must
        // not be invented here. Every entry present is cross-checked against its bhinna row below.
        perPlanet: z.partialRecord(ashtakavargaPlanetSchema, z.number().int().min(0)),
        grandTotal: z.number().int().min(0),
      })
      .optional(),
    legend: ashtakavargaLegendSchema.optional(),
    /**
     * Signs whose total is below the rule set's stated strength threshold, when the rule set defines one. The UI never
     * derives this itself from `sarva`: the threshold is rule-set knowledge, not a client constant.
     */
    weakSigns: z.array(signSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.availability !== 'computed' && !value.reason) {
      ctx.addIssue({
        code: 'custom',
        message: 'an ashtakavarga section that is not computed requires a reason',
      });
    }
    if (value.availability === 'computed' && value.reason !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'a computed section must not carry an unavailability reason' });
    }

    if (value.availability !== 'computed') return;

    // Computed means the whole payload, not part of it. A half-populated section would render as an empty chart,
    // which reads as "zero bindus everywhere" - a wrong factual claim rather than an honest gap.
    const missing = [
      value.rulesVersion ? null : 'rulesVersion',
      value.bhinna ? null : 'bhinna',
      value.sarva ? null : 'sarva',
      value.totals ? null : 'totals',
      value.legend ? null : 'legend',
    ].filter((field): field is string => field !== null);
    if (missing.length > 0) {
      ctx.addIssue({ code: 'custom', message: `computed section is missing: ${missing.join(', ')}` });
      return;
    }

    const bhinna = value.bhinna ?? [];
    const sarva = value.sarva ?? [];

    const planets = new Set<string>();
    for (const row of bhinna) {
      if (planets.has(row.planet)) {
        ctx.addIssue({ code: 'custom', message: `duplicate bhinna row for ${row.planet}` });
      }
      planets.add(row.planet);

      const summed = row.bindus.reduce((acc, n) => acc + n, 0);
      if (summed !== row.total) {
        ctx.addIssue({
          code: 'custom',
          message: `bhinna row for ${row.planet} totals ${row.total} but its twelve sign values sum to ${summed}`,
        });
      }
    }

    // The reconciliation invariant. Per sign: the sum of every planet's bindus must equal the sarva total.
    for (let index = 0; index < BINDUS_PER_SIGN; index += 1) {
      const perSign = bhinna.reduce((acc, row) => acc + (row.bindus[index] ?? 0), 0);
      if (perSign !== sarva[index]) {
        ctx.addIssue({
          code: 'custom',
          message: `sign ${signOrder[index]} reconciles to ${perSign} but sarva reports ${sarva[index]}`,
        });
      }
    }

    const grandTotal = sarva.reduce((acc, n) => acc + n, 0);
    if (value.totals && value.totals.grandTotal !== grandTotal) {
      ctx.addIssue({
        code: 'custom',
        message: `grandTotal ${value.totals.grandTotal} does not equal the sarva sum ${grandTotal}`,
      });
    }

    for (const row of bhinna) {
      const reported = value.totals?.perPlanet[row.planet];
      if (reported !== undefined && reported !== row.total) {
        ctx.addIssue({
          code: 'custom',
          message: `perPlanet total for ${row.planet} is ${reported} but its row reports ${row.total}`,
        });
      }
    }
  });
export type KundaliAshtakavarga = z.infer<typeof kundaliAshtakavargaSchema>;
