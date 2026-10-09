import { z } from 'zod';

import { isoDate, isoInstant } from './primitives';

/**
 * Find a Good Time status and day summary, shared by `/muhurta/day-summaries` and the `goodTime` of every Panchang day.
 * Kept apart from ./muhurta so ./panchang can use it without a circular import.
 */

export const muhurtaStatusSchema = z.object({
  /** `HighlyFavorable`, `Favorable`, `Mixed`, `Caution` or `Avoid`. Branch on this, never on `name`. */
  status: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
});

export const goodTimeWindowSchema = z.object({
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
  status: muhurtaStatusSchema,
});

export const muhurtaDaySummarySchema = z.object({
  date: isoDate,
  dateDisplay: z.string(),
  status: muhurtaStatusSchema,
  goodTimeCount: z.number().int(),
  bestGoodTime: goodTimeWindowSchema.nullable(),
  noGoodTimeReason: z.string().nullable(),
});

export type MuhurtaStatusInfo = z.infer<typeof muhurtaStatusSchema>;
export type GoodTimeWindow = z.infer<typeof goodTimeWindowSchema>;
export type MuhurtaDaySummary = z.infer<typeof muhurtaDaySummarySchema>;
