import type { ResolvedLocation } from '@myvedicstar/contracts';
import { parseLocationInput } from '@myvedicstar/validation';
import { z } from 'zod';

/**
 * A location the user chose. Legacy resolution rounds coordinates; the GeoNames workflow preserves the final
 * coordinates supplied by the user or device. Location preferences stay on the device.
 */
export interface SelectedLocation {
  /** Stable coordinate identity for de-duplication. */
  id: string;
  /** Short label, e.g. "Austin, Texas". */
  label: string;
  /** Full name when known, e.g. "Austin, Texas, United States". */
  fullName: string | undefined;
  latitude: number;
  longitude: number;
  /** IANA time zone used for every displayed time. */
  timeZone: string;
  countryCode: string | undefined;
  source: 'current' | 'search' | 'coordinates';
  /** Provider result kind without changing the existing source contract. */
  selectionKind?: 'city' | 'postal' | undefined;
  geonameId?: string | undefined;
  postalCode?: string | undefined;
  city?: string | undefined;
  region?: string | undefined;
  country?: string | undefined;
}

export const COORDINATE_DECIMALS = 2;
export const MAX_RECENT_LOCATIONS = 5;

export function roundCoordinate(value: number, decimals = COORDINATE_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function toSelectedLocation(
  resolved: ResolvedLocation,
  source: SelectedLocation['source'],
): SelectedLocation {
  const latitude = roundCoordinate(resolved.latitude);
  const longitude = roundCoordinate(resolved.longitude);
  const place = resolved.place;
  const label = place
    ? [place.city, place.state ?? place.country].filter(Boolean).join(', ')
    : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  return {
    id: `${latitude.toFixed(2)},${longitude.toFixed(2)}`,
    label,
    fullName: place?.displayName,
    latitude,
    longitude,
    timeZone: resolved.timeZone,
    countryCode: place?.countryCode,
    city: place?.city,
    region: place?.state ?? undefined,
    country: place?.country,
    source,
  };
}

/** Most recent first, de-duplicated by id, capped. */
export function addRecentLocation(
  recent: readonly SelectedLocation[],
  location: SelectedLocation,
  max = MAX_RECENT_LOCATIONS,
): SelectedLocation[] {
  return [
    location,
    ...recent.filter(
      (l) => l.id !== location.id && (!location.geonameId || l.geonameId !== location.geonameId),
    ),
  ].slice(0, max);
}

/** Location parameters for Panchang requests: the resolved coordinates plus their zone. */
export function panchangLocationParams(location: SelectedLocation) {
  return { latitude: location.latitude, longitude: location.longitude, timeZone: location.timeZone };
}

/** Anything that can resolve a place or coordinates (the API client's `locations.resolve`). */
export type LocationResolver = (params: {
  place?: string;
  latitude?: number;
  longitude?: number;
}) => Promise<ResolvedLocation>;

export type LocationSearchResult =
  | { ok: true; location: SelectedLocation }
  | { ok: false; reason: 'invalid'; messageKey: string }
  | { ok: false; reason: 'postalCodeUnsupported' };

/**
 * Resolves what the user typed — `Austin`, `Austin, TX`, `Hyderabad, Telangana, India`, `30.2672, -97.7431` — through
 * the backend. Postal codes are recognized but not yet supported by the backend, so the UI can say so clearly.
 * Backend errors (not found, network) are thrown for the caller to present.
 */
export async function searchLocation(
  input: string,
  resolve: LocationResolver,
): Promise<LocationSearchResult> {
  const parsed = parseLocationInput(input);
  if (!parsed.ok) return { ok: false, reason: 'invalid', messageKey: `validation.${parsed.error}` };

  const value = parsed.value;
  switch (value.kind) {
    case 'postalCode':
      return { ok: false, reason: 'postalCodeUnsupported' };
    case 'coordinates':
      return {
        ok: true,
        location: toSelectedLocation(
          await resolve({ latitude: value.latitude, longitude: value.longitude }),
          'coordinates',
        ),
      };
    case 'place':
      return { ok: true, location: toSelectedLocation(await resolve({ place: value.place }), 'search') };
  }
}

/**
 * Stored locations are user-controlled input (device storage can be edited): validate on every read.
 * Exact GeoNames coordinates and legacy rounded coordinates are both supported.
 */
export const selectedLocationSchema = z.object({
  id: z.string().max(40),
  label: z.string().min(1).max(160),
  fullName: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timeZone: z.string().regex(/^[A-Za-z0-9_+\-/]{1,64}$/),
  countryCode: z.string().max(3).optional(),
  source: z.enum(['current', 'search', 'coordinates']),
  selectionKind: z.enum(['city', 'postal']).optional(),
  geonameId: z.string().max(160).optional(),
  postalCode: z.string().max(20).optional(),
  city: z.string().max(160).optional(),
  region: z.string().max(160).optional(),
  country: z.string().max(160).optional(),
});

export const recentLocationsSchema = z.array(selectedLocationSchema).max(10);

/** Parses a stored value; undefined when missing or invalid. */
export function parseStoredLocation(value: unknown): SelectedLocation | undefined {
  const result = selectedLocationSchema.safeParse(value);
  return result.success
    ? { ...result.data, fullName: result.data.fullName, countryCode: result.data.countryCode }
    : undefined;
}

export function parseStoredRecentLocations(value: unknown): SelectedLocation[] {
  const result = recentLocationsSchema.safeParse(value);
  return result.success
    ? result.data.map((l) => ({ ...l, fullName: l.fullName, countryCode: l.countryCode }))
    : [];
}
