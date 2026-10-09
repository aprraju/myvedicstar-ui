import { z } from 'zod';

import { displayFormatSchema, locationSchema } from './panchang';
import { isoDate, isoInstant } from './primitives';

/**
 * Schemas mirror `GET /api/v1/festivals/upcoming` (`FestivalsResponse` in the MyVedicDay OpenAPI document).
 * `category` and `observanceTime` are validated as strings so a new value never breaks the whole response.
 */

export type KnownFestivalCategory = 'festival' | 'observance';

export const festivalTimingSchema = z.object({
  /** `Tithi`, `Nakshatra` or `Sankranti`. */
  basis: z.string(),
  basisKey: z.string(),
  /** When the Tithi or Nakshatra begins and ends, or the Sankranti instant (start = end). */
  start: isoInstant,
  end: isoInstant,
  startDisplay: z.string(),
  endDisplay: z.string(),
  /** The moment the rules use to decide the date, e.g. `Sunrise`, `Pradosha`, `Nishita`. */
  observanceTime: z.string(),
  observanceTimeName: z.string(),
  /** Null for days offset from the anchor day (e.g. Holi, Bhogi, Kanuma). */
  observanceStart: isoInstant.nullable(),
  observanceEnd: isoInstant.nullable(),
  observanceStartDisplay: z.string().nullable(),
  observanceEndDisplay: z.string().nullable(),
});

export const festivalSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  categoryName: z.string(),
  icon: z.string().nullable(),
  date: isoDate,
  dateDisplay: z.string(),
  daysFromToday: z.number().int(),
  timing: festivalTimingSchema,
});

export const festivalsResponseSchema = z.object({
  location: locationSchema,
  tradition: z.object({ key: z.string(), name: z.string() }),
  localToday: isoDate,
  localTodayDisplay: z.string(),
  from: isoDate,
  to: isoDate,
  displayFormat: displayFormatSchema,
  generatedAt: isoInstant,
  language: z.string(),
  rulesVersion: z.string(),
  calculationVersion: z.string(),
  festivals: z.array(festivalSchema),
});

export type FestivalTiming = z.infer<typeof festivalTimingSchema>;
export type Festival = z.infer<typeof festivalSchema>;
export type FestivalsResponse = z.infer<typeof festivalsResponseSchema>;
