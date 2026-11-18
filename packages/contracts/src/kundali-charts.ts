import { z } from 'zod';

/**
 * KUN-07 charts contract.
 *
 * The payload carries POSITIONS, never a drawing. A style adapter maps these to its own geometry, so all three styles
 * are guaranteed to show the same facts: a style cannot disagree about a placement because it never sees a separate
 * copy of them.
 *
 * `precision` is the safety gate for the whole section. When `status` is not 'computed', the UI renders NO chart at
 * all - an empty North Indian diamond reads as a rendering bug, not as "not calculated yet".
 */

export const divisionalChartValues = [
  'D1',
  'D2',
  'D3',
  'D7',
  'D9',
  'D10',
  'D12',
  'D30',
  'D60',
  'BhavaChalit',
] as const;
export const divisionalChartSchema = z.enum(divisionalChartValues);
export type DivisionalChart = z.infer<typeof divisionalChartSchema>;

/** Why a chart could not be drawn. Localizable codes, never prose. */
export const chartPrecisionStatusValues = ['computed', 'approximate', 'unvalidated-reference'] as const;
export const chartPrecisionSchema = z.object({
  status: z.enum(chartPrecisionStatusValues),
  /** Present when status is not 'computed'. */
  reason: z.string().optional(),
});
export type ChartPrecision = z.infer<typeof chartPrecisionSchema>;

export const chartPlacementSchema = z.object({
  planet: z.string().min(1),
  sign: z.string().min(1),
  degree: z.number().min(0).lt(30),
});
export type ChartPlacement = z.infer<typeof chartPlacementSchema>;

export const chartHouseSchema = z.object({
  sign: z.string().min(1),
  placements: z.array(chartPlacementSchema),
});
export type ChartHouse = z.infer<typeof chartHouseSchema>;

export const divisionalChartResponseSchema = z.object({
  divisional: divisionalChartSchema,
  method: z.string().min(1),
  houses: z.array(chartHouseSchema),
  precision: chartPrecisionSchema,
});
export type DivisionalChartResponse = z.infer<typeof divisionalChartResponseSchema>;

/**
 * A chart may only be drawn when its houses are present AND its precision is 'computed'.
 *
 * This is the single predicate the renderer consults. Keeping it here means the "never draw a placeholder" rule is
 * one function with one test, rather than a condition duplicated across three style adapters.
 */
export function isChartDrawable(response: DivisionalChartResponse | undefined): boolean {
  if (!response) return false;
  if (response.precision.status !== 'computed') return false;
  return response.houses.length > 0;
}
