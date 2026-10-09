import { z } from 'zod';

/** Mirrors the backend's `PlaceNameAttribute`: letters in any script, digits, spaces and `. , ' ( ) -`. */
export const PLACE_MAX_LENGTH = 120;
const PLACE_PATTERN = /^[\p{L}\p{M}0-9 .,'()-]+$/u;

/** Postal codes worldwide are at most 10 characters; letters, digits, spaces and hyphens. */
export const POSTAL_CODE_MAX_LENGTH = 10;
const POSTAL_CODE_PATTERN = /^(?=.*\d)[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;

const COORDINATE_PAIR_PATTERN = /^\s*([+-]?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/;

export const latitudeSchema = z
  .number({ error: 'location.latitude.invalid' })
  .finite({ error: 'location.latitude.invalid' })
  .min(-90, { error: 'location.latitude.range' })
  .max(90, { error: 'location.latitude.range' });

export const longitudeSchema = z
  .number({ error: 'location.longitude.invalid' })
  .finite({ error: 'location.longitude.invalid' })
  .min(-180, { error: 'location.longitude.range' })
  .max(180, { error: 'location.longitude.range' });

export const coordinatesSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const placeNameSchema = z
  .string()
  .trim()
  .min(2, { error: 'location.place.tooShort' })
  .max(PLACE_MAX_LENGTH, { error: 'location.place.tooLong' })
  .regex(PLACE_PATTERN, { error: 'location.place.invalidCharacters' });

/** IANA time zone identifier, e.g. `America/Chicago` (same pattern as the backend). */
export const timeZoneSchema = z
  .string()
  .regex(/^[A-Za-z0-9_+\-/]{1,64}$/, { error: 'location.timeZone.invalid' });

export type Coordinates = z.infer<typeof coordinatesSchema>;

/**
 * What a user typed into the single location search box, classified.
 * Error values are localization keys (see @myvedicstar/localization `validation.*`).
 */
export type LocationInput =
  | { kind: 'coordinates'; latitude: number; longitude: number }
  | { kind: 'postalCode'; postalCode: string }
  | { kind: 'place'; place: string; parts: readonly string[] };

export type LocationInputResult = { ok: true; value: LocationInput } | { ok: false; error: string };

/**
 * Classifies free-text location input:
 * `30.2672, -97.7431` → coordinates; `78701` → postal code; `Austin` / `Austin, TX` / `Austin, TX, USA` → place.
 * Pure parsing only — resolution happens in the location feature through the backend.
 */
export function parseLocationInput(raw: string): LocationInputResult {
  const text = raw.trim();
  if (text.length === 0) {
    return { ok: false, error: 'location.input.required' };
  }
  if (text.length > PLACE_MAX_LENGTH) {
    return { ok: false, error: 'location.place.tooLong' };
  }

  const pair = COORDINATE_PAIR_PATTERN.exec(text);
  if (pair) {
    const result = coordinatesSchema.safeParse({ latitude: Number(pair[1]), longitude: Number(pair[2]) });
    if (!result.success) {
      return { ok: false, error: result.error.issues[0]?.message ?? 'location.coordinates.invalid' };
    }
    return { ok: true, value: { kind: 'coordinates', ...result.data } };
  }

  if (text.length <= POSTAL_CODE_MAX_LENGTH && POSTAL_CODE_PATTERN.test(text) && !/,/.test(text)) {
    return { ok: true, value: { kind: 'postalCode', postalCode: text.toUpperCase() } };
  }

  const place = placeNameSchema.safeParse(text);
  if (!place.success) {
    return { ok: false, error: place.error.issues[0]?.message ?? 'location.place.invalid' };
  }

  const parts = place.data
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0 || parts.length > 3) {
    return { ok: false, error: 'location.place.format' };
  }
  return { ok: true, value: { kind: 'place', place: parts.join(', '), parts } };
}

/** Form schema for the manual latitude/longitude form (inputs arrive as strings). */
export const coordinatesFormSchema = z.object({
  latitude: z
    .string()
    .trim()
    .min(1, { error: 'location.latitude.required' })
    .max(20, { error: 'location.latitude.invalid' })
    .transform(Number)
    .pipe(latitudeSchema),
  longitude: z
    .string()
    .trim()
    .min(1, { error: 'location.longitude.required' })
    .max(20, { error: 'location.longitude.invalid' })
    .transform(Number)
    .pipe(longitudeSchema),
});
