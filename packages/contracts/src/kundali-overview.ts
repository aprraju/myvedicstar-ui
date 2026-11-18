import { z } from 'zod';

/**
 * KUN-05 overview contract.
 *
 * Binding shape from the architect (2026-11-17). Two rules are load-bearing:
 *  - Optional blocks are ABSENT, never null. `z.object` with `.optional()` and no `.nullable()` enforces that, so a
 *    server that sends `null` fails validation here rather than rendering as an empty chart in the UI.
 *  - `unsupported` carries localizable CODES, never prose. The UI maps them through its catalog; the server must not
 *    put user-visible English in a response field.
 */

/** Why a computed block is missing. Localizable: mapped to catalog entries, never rendered raw. */
export const unsupportedReasonValues = [
  'engine-unavailable',
  'birth-time-unknown',
  'birth-time-approximate',
] as const;
export const unsupportedReasonSchema = z.enum(unsupportedReasonValues);
export type UnsupportedReason = z.infer<typeof unsupportedReasonSchema>;

/** Birth time as the user recorded it. `unknown` carries no time fields at all - no sentinel, no assumed noon. */
export const birthDetailsSchema = z
  .object({
    name: z.string().min(1),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
    birthTimeMode: z.enum(['exact', 'approximate', 'unknown']),
    /** Present only when birthTimeMode is 'exact'. */
    birthTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    /** Present only when birthTimeMode is 'approximate'. */
    windowStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    windowEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    placeName: z.string().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timeZoneId: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    // The mode and the fields must agree. Catching this here means a mis-shaped payload cannot reach the UI and be
    // rendered as though it were definitive.
    if (value.birthTimeMode === 'exact' && !value.birthTime) {
      ctx.addIssue({ code: 'custom', message: 'exact birth time requires birthTime' });
    }
    if (value.birthTimeMode === 'approximate' && (!value.windowStart || !value.windowEnd)) {
      ctx.addIssue({ code: 'custom', message: 'approximate birth time requires windowStart and windowEnd' });
    }
    if (value.birthTimeMode === 'unknown' && (value.birthTime || value.windowStart || value.windowEnd)) {
      ctx.addIssue({ code: 'custom', message: 'unknown birth time must not carry a time value' });
    }
  });
export type BirthDetails = z.infer<typeof birthDetailsSchema>;

export const ascendantSchema = z.object({
  sign: z.string().min(1),
  degreeWithinSign: z.number().min(0).lt(30),
  nakshatra: z.string().min(1),
});
export type Ascendant = z.infer<typeof ascendantSchema>;

/** `endUtc` is a UTC instant: a dasha boundary is an instant, not a calendar day. Render in the profile's zone. */
export const currentDashaSchema = z.object({
  lord: z.string().min(1),
  level: z.string().min(1),
  startUtc: z.string().datetime({ offset: true }),
  endUtc: z.string().datetime({ offset: true }),
});
export type CurrentDasha = z.infer<typeof currentDashaSchema>;

export const keyPlacementSchema = z.object({
  graha: z.string().min(1),
  sign: z.string().min(1),
  house: z.number().int(),
  retrograde: z.boolean(),
});
export type KeyPlacement = z.infer<typeof keyPlacementSchema>;

export const unsupportedEntrySchema = z.object({
  path: z.string().min(1),
  reason: unsupportedReasonSchema,
});
export type UnsupportedEntry = z.infer<typeof unsupportedEntrySchema>;

export const conventionsSchema = z.object({
  ephemerisProvider: z.string().min(1),
  ephemerisVersion: z.string().min(1),
  ayanamsa: z.string().min(1),
  houseSystem: z.string().min(1),
  nodeType: z.string().min(1),
  zodiac: z.string().min(1),
});
export type Conventions = z.infer<typeof conventionsSchema>;

export const kundaliOverviewSchema = z.object({
  birthDetails: birthDetailsSchema,
  ascendant: ascendantSchema.optional(),
  moonSign: z.string().min(1).optional(),
  sunSign: z.string().min(1).optional(),
  currentDasha: currentDashaSchema.optional(),
  keyPlacements: z.array(keyPlacementSchema).optional(),
  unsupported: z.array(unsupportedEntrySchema),
  conventions: conventionsSchema,
});
export type KundaliOverview = z.infer<typeof kundaliOverviewSchema>;
