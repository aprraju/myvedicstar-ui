import { z } from 'zod';

import { muhurtaDaySummarySchema } from './muhurta-summary';
import { isoDate, isoInstant } from './primitives';

/**
 * Schemas mirror `MyVedicDay.Api/Contracts/Panchang/PanchangResponse.cs`.
 *
 * Enumerations the backend may extend (classification, rating, period kind) are validated as strings so a new value
 * never breaks the whole response; the `Known*` unions document the values the UI understands today.
 */

export type KnownPeriodClassification = 'HighlyFavorable' | 'Favorable' | 'Neutral' | 'Caution' | 'Avoid';
export type KnownGuidanceRating = 'HighlyFavorable' | 'Favorable' | 'Mixed' | 'Caution' | 'Avoid';

export const placeSchema = z.object({
  city: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  countryCode: z.string(),
  displayName: z.string(),
});

export const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timeZone: z.string(),
  /** `Coordinates` (browser position) or `Place` (city search). */
  source: z.string(),
  place: placeSchema.nullable(),
});

export const traditionSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** Timings shown by the tradition, in order of emphasis (period kinds or `Choghadiya`). */
  display: z.array(z.string()),
});

export const displayFormatSchema = z.object({
  datePattern: z.string(),
  timePattern: z.string(),
  countryCode: z.string().nullable(),
  example: z.string(),
});

export const glossaryEntrySchema = z.object({
  name: z.string(),
  meaning: z.string().nullable(),
  description: z.string().nullable(),
  message: z.string().nullable(),
  icon: z.string().nullable(),
});

/** Sections (`periods`, `elements`, `terms`, `classifications`, …) → key → entry. */
export const glossarySchema = z.record(z.string(), z.record(z.string(), glossaryEntrySchema));

export const panchangElementSchema = z.object({
  key: z.string(),
  number: z.number().int(),
  name: z.string(),
  /** Backend content labels; optional for cached responses from earlier API versions. */
  shortName: z.string().nullable().optional(),
  compactName: z.string().nullable().optional(),
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
});

/** A caution or avoid period overlapping a favorable period, resolved by the backend. */
export const periodOverlapSchema = z.object({
  kind: z.string(),
  name: z.string(),
  classification: z.string(),
  /** The overlapping part (times to avoid within the favorable period). */
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
});

export const timePeriodSchema = z.object({
  kind: z.string(),
  name: z.string(),
  classification: z.string(),
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
  /** Favorable periods only: unfavorable periods overlapping this one (omitted when none). */
  overlaps: z.array(periodOverlapSchema).optional(),
  /** Favorable periods only: localized note naming the times to avoid (omitted when none). */
  overlapMessage: z.string().optional(),
});

export const guidanceWindowSchema = z.object({
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
});

export const guidanceFactorSchema = z.object({
  limb: z.string(),
  limbName: z.string(),
  key: z.string(),
  name: z.string(),
  rating: z.string(),
  ratingName: z.string(),
  reason: z.string(),
});

export const dailyGuidanceSchema = z.object({
  rating: z.string(),
  ratingName: z.string(),
  icon: z.string(),
  headline: z.string(),
  summary: z.string(),
  factors: z.array(guidanceFactorSchema),
  bestWindows: z.array(guidanceWindowSchema),
  favorableWindows: z.array(timePeriodSchema),
  spiritualWindows: z.array(timePeriodSchema),
  cautionWindows: z.array(timePeriodSchema),
  avoidWindows: z.array(timePeriodSchema),
  methodology: z.string(),
  rulesVersion: z.string(),
});

export const dailyPanchangSchema = z.object({
  date: isoDate,
  dateDisplay: z.string(),
  weekday: z.string(),
  weekdayName: z.string(),
  sunrise: isoInstant,
  sunset: isoInstant,
  nextSunrise: isoInstant,
  sunriseDisplay: z.string(),
  sunsetDisplay: z.string(),
  nextSunriseDisplay: z.string(),
  tithis: z.array(panchangElementSchema),
  nakshatras: z.array(panchangElementSchema),
  yogas: z.array(panchangElementSchema),
  karanas: z.array(panchangElementSchema),
  auspiciousPeriods: z.array(timePeriodSchema),
  inauspiciousPeriods: z.array(timePeriodSchema),
  guidance: dailyGuidanceSchema,
  /**
   * The day's resolved Find a Good Time status for the General activity (calendar tiles, Home). Optional so responses
   * from older API versions still parse; never derive it from the periods above.
   */
  goodTime: muhurtaDaySummarySchema.optional(),
  /** Present only when the tradition shows Choghadiya. */
  choghadiya: z.array(timePeriodSchema).optional(),
});

export const panchangResponseSchema = z.object({
  location: locationSchema,
  tradition: traditionSchema,
  calculationMethod: z.string(),
  calculationVersion: z.string(),
  localToday: isoDate,
  localTodayDisplay: z.string(),
  displayFormat: displayFormatSchema,
  generatedAt: isoInstant,
  language: z.string(),
  glossary: glossarySchema,
  days: z.array(dailyPanchangSchema),
});

export const panchangTraditionsResponseSchema = z.object({
  language: z.string(),
  traditions: z.array(traditionSchema),
});

export const glossaryResponseSchema = z.object({
  language: z.string(),
  sections: glossarySchema,
});

export type Place = z.infer<typeof placeSchema>;
export type ResolvedLocation = z.infer<typeof locationSchema>;
export type PanchangTradition = z.infer<typeof traditionSchema>;
export type DisplayFormat = z.infer<typeof displayFormatSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type Glossary = z.infer<typeof glossarySchema>;
export type PanchangElement = z.infer<typeof panchangElementSchema>;
export type PeriodOverlapInfo = z.infer<typeof periodOverlapSchema>;
export type TimePeriod = z.infer<typeof timePeriodSchema>;
export type GuidanceWindow = z.infer<typeof guidanceWindowSchema>;
export type GuidanceFactor = z.infer<typeof guidanceFactorSchema>;
export type DailyGuidance = z.infer<typeof dailyGuidanceSchema>;
export type DailyPanchang = z.infer<typeof dailyPanchangSchema>;
export type PanchangResponse = z.infer<typeof panchangResponseSchema>;
export type PanchangTraditionsResponse = z.infer<typeof panchangTraditionsResponseSchema>;
export type GlossaryResponse = z.infer<typeof glossaryResponseSchema>;
