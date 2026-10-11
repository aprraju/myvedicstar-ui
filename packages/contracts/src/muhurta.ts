import { z } from 'zod';

import { muhurtaDaySummarySchema, muhurtaStatusSchema } from './muhurta-summary';
import { displayFormatSchema, locationSchema } from './panchang';
import { isoDate, isoInstant } from './primitives';

/**
 * Schemas mirror the Find a Good Time endpoints (`/muhurta/activities`, `/muhurta/good-times`,
 * `/muhurta/good-times/explanation`, `/muhurta/day-summaries`; `MuhurtaResponses.cs` in the MyVedicDay API).
 *
 * The backend rules engine is authoritative: clients render `status`, `isGoodTime`, reasons and conflicts as given and
 * never derive or promote a Good Time themselves. Statuses, codes and icon keys are validated as strings so a new value
 * never breaks the whole response; the `Known*` unions document the values the UI understands today.
 */

export type KnownMuhurtaStatus = 'HighlyFavorable' | 'Favorable' | 'Mixed' | 'Caution' | 'Avoid';
export type KnownActivityKey =
  | 'business'
  | 'travel'
  | 'property'
  | 'vehicle'
  | 'agreement'
  | 'education'
  | 'puja'
  | 'wedding'
  | 'housewarming'
  | 'general'
  | 'other';

export const muhurtaNakshatrasResponseSchema = z.array(
  z.object({
    key: z.string(),
    name: z.string(),
    order: z.number().int(),
  }),
);

export const muhurtaActivitySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** Icon key, e.g. `briefcase`; unknown keys fall back to a generic icon. */
  icon: z.string(),
  order: z.number().int(),
  /** The user must describe the activity (`other`); send it as `otherText`. */
  requiresInput: z.boolean(),
  /** `full`, or `partial` when a complete Muhurta needs factors this guidance does not include. */
  completeness: z.string(),
});

export const muhurtaActivitiesResponseSchema = z.object({
  language: z.string(),
  rulesVersion: z.string(),
  defaultActivity: z.string(),
  activities: z.array(muhurtaActivitySchema),
});

export const evaluatedActivitySchema = z.object({
  key: z.string(),
  name: z.string(),
  icon: z.string(),
  /** `other` when free text was mapped to `key`. */
  requested: z.string(),
  requestedText: z.string().nullable(),
  completeness: z.string(),
});

export const goodTimeReasonSchema = z.object({
  /** `positive`, `negative` or `info`. */
  type: z.string(),
  /** Stable code, e.g. `FAVORABLE_NAKSHATRA`, `AMRIT_KALAM`, `NO_RAHU_KALAM_CONFLICT`. */
  code: z.string(),
  label: z.string(),
  subject: z.string().nullable(),
});

export const goodTimeConflictSchema = z.object({
  /** Stable code, e.g. `RAHU_KALAM`. */
  code: z.string(),
  /** Period kind as in Panchang responses, e.g. `RahuKalam`. */
  kind: z.string(),
  /** Best status the period allows here. */
  severity: z.string(),
  label: z.string(),
  withFavorable: z.boolean(),
  /** The whole unfavorable period. */
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
  /** The part inside the segment. */
  overlapStart: isoInstant,
  overlapEnd: isoInstant,
  overlapStartDisplay: z.string(),
  overlapEndDisplay: z.string(),
});

export const goodTimeSegmentSchema = z.object({
  id: z.string(),
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
  timeRangeDisplay: z.string(),
  status: muhurtaStatusSchema,
  /** For ordering only; never display as a percentage. */
  score: z.number(),
  /** The only flag that may be shown as a Good Time. */
  isGoodTime: z.boolean(),
  headline: z.string(),
  reasons: z.array(goodTimeReasonSchema),
  conflicts: z.array(goodTimeConflictSchema),
});

export const muhurtaTraditionSchema = z.object({ key: z.string(), name: z.string() });

export const goodTimesResponseSchema = z.object({
  location: locationSchema,
  tradition: muhurtaTraditionSchema,
  activity: evaluatedActivitySchema,
  date: isoDate,
  dateDisplay: z.string(),
  localToday: isoDate,
  displayFormat: displayFormatSchema,
  generatedAt: isoInstant,
  language: z.string(),
  rulesVersion: z.string(),
  calculationVersion: z.string(),
  dayStatus: muhurtaStatusSchema,
  segments: z.array(goodTimeSegmentSchema),
  /** Segment ids of the Good Times, best first; empty when none qualifies. */
  goodTimes: z.array(z.string()),
  noGoodTimeReason: z.string().nullable(),
  noGoodTimeMessage: z.string().nullable(),
  nowSegmentId: z.string().nullable(),
  nextGoodTimeId: z.string().nullable(),
  notices: z.array(z.string()),
  disclaimer: z.string(),
});

export const goodTimeExplanationResponseSchema = z.object({
  activity: evaluatedActivitySchema,
  date: isoDate,
  language: z.string(),
  rulesVersion: z.string(),
  /** `ai` (validated against the evaluation) or `template`. */
  source: z.string(),
  summary: z.string(),
  notes: z.array(z.object({ segmentId: z.string(), text: z.string() })),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  promptVersion: z.string(),
  fallbackReason: z.string().nullable(),
  disclaimer: z.string(),
});

export const daySummariesResponseSchema = z.object({
  location: locationSchema,
  tradition: muhurtaTraditionSchema,
  activity: evaluatedActivitySchema,
  localToday: isoDate,
  displayFormat: displayFormatSchema,
  language: z.string(),
  rulesVersion: z.string(),
  days: z.array(muhurtaDaySummarySchema),
});

export const bestGoodTimeSchema = z.object({
  /** 1 for the best option. */
  rank: z.number().int(),
  date: isoDate,
  dateDisplay: z.string(),
  /** The same segment (same `id`) as `/muhurta/good-times` returns for `date`. Always a Good Time. */
  segment: goodTimeSegmentSchema,
});

/** `/muhurta/good-times/best`: the next best Good Times, at most one per day, best first. */
export const bestGoodTimesResponseSchema = z.object({
  location: locationSchema,
  tradition: muhurtaTraditionSchema,
  activity: evaluatedActivitySchema,
  localToday: isoDate,
  displayFormat: displayFormatSchema,
  generatedAt: isoInstant,
  language: z.string(),
  rulesVersion: z.string(),
  calculationVersion: z.string(),
  searchedFrom: isoDate,
  searchedThrough: isoDate,
  /** Highly Favorable before Favorable, then soonest. Empty when none qualifies: nothing is promoted. */
  options: z.array(bestGoodTimeSchema),
  noGoodTimeMessage: z.string().nullable(),
  notices: z.array(z.string()),
  disclaimer: z.string(),
});

export type MuhurtaActivity = z.infer<typeof muhurtaActivitySchema>;
export type MuhurtaActivitiesResponse = z.infer<typeof muhurtaActivitiesResponseSchema>;
export type EvaluatedActivity = z.infer<typeof evaluatedActivitySchema>;
export type GoodTimeReason = z.infer<typeof goodTimeReasonSchema>;
export type GoodTimeConflict = z.infer<typeof goodTimeConflictSchema>;
export type GoodTimeSegment = z.infer<typeof goodTimeSegmentSchema>;
export type GoodTimesResponse = z.infer<typeof goodTimesResponseSchema>;
export type GoodTimeExplanationResponse = z.infer<typeof goodTimeExplanationResponseSchema>;
export type DaySummariesResponse = z.infer<typeof daySummariesResponseSchema>;
export type BestGoodTime = z.infer<typeof bestGoodTimeSchema>;
export type BestGoodTimesResponse = z.infer<typeof bestGoodTimesResponseSchema>;

export * from './muhurta-summary';
