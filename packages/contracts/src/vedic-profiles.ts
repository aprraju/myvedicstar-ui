import { z } from 'zod';

/**
 * Vedic Profiles wire contract — mirrors MyVedicStar.VedicProfiles.Api (Contracts/VedicProfileContracts.cs) and
 * MyVedicStar.VedicProfiles.Shared. Names and casing match what the C# serializer emits; do not rename.
 */

// Enum values are exactly the C# enum member names, sent as strings. Anything else is a 400 from the server.
export const birthTimeModeValues = ['Known', 'Approximate', 'Unknown'] as const;
export const birthTimeModeSchema = z.enum(birthTimeModeValues);
export type BirthTimeMode = z.infer<typeof birthTimeModeSchema>;

export const relationshipValues = [
  'Self',
  'Father',
  'Mother',
  'Wife',
  'Husband',
  'Son',
  'Daughter',
  'Other',
] as const;
export const relationshipSchema = z.enum(relationshipValues);
export type Relationship = z.infer<typeof relationshipSchema>;

/** Second-precision wall-clock HH:mm:ss. Never converted between zones. */
const wallClock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
/** ISO calendar date, yyyy-MM-dd — what DateOnly serializes to. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const limits = {
  name: 256,
  locationName: 512,
  timezoneId: 128,
  gender: 128,
  occupation: 256,
  customRelationship: 256,
  timeAccuracyNote: 2000,
} as const;

/**
 * Create/replace payload. Account id, resource id and revision are never sent here; the replace variant adds only
 * `revision`. Unknown keys: none — the server binds by name, so extra keys must not creep in.
 */
export const vedicProfileRequestSchema = z.object({
  name: z.string().max(limits.name),
  dateOfBirth: isoDate,
  birthTimeMode: birthTimeModeSchema,
  /** Known: all three times equal. Approximate: both endpoints set, birthTime null. Unknown: all null. */
  birthTime: wallClock.nullable(),
  birthTimeFrom: wallClock.nullable(),
  birthTimeTo: wallClock.nullable(),
  timeAccuracyNote: z.string().max(limits.timeAccuracyNote).nullable(),
  locationName: z.string().min(1).max(limits.locationName),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezoneId: z.string().min(1).max(limits.timezoneId),
  gender: z.string().max(limits.gender),
  occupation: z.string().max(limits.occupation).nullable(),
  relationship: relationshipSchema,
  customRelationship: z.string().max(limits.customRelationship).nullable(),
});
export type VedicProfileRequest = z.infer<typeof vedicProfileRequestSchema>;

/** Replace adds the revision the client last saw; a stale one is a 409. */
export const replaceVedicProfileRequestSchema = vedicProfileRequestSchema.extend({
  revision: z.number().int().nonnegative(),
});
export type ReplaceVedicProfileRequest = z.infer<typeof replaceVedicProfileRequestSchema>;

export const vedicProfileSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  relationship: z.string(),
  customRelationship: z.string().nullable(),
  revision: z.number().int().nonnegative(),
});
export type VedicProfileSummary = z.infer<typeof vedicProfileSummarySchema>;

export const vedicProfileSchema = vedicProfileRequestSchema.extend({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
});
export type VedicProfile = z.infer<typeof vedicProfileSchema>;
