import { z } from 'zod';

/** Application-owned DTOs from the GeoNames proxy, independent of provider response shapes. */
export const locationSuggestionSchema = z.object({
  id: z.string().min(1).max(160),
  city: z.string().min(1).max(160),
  region: z.string().max(160).nullable(),
  country: z.string().max(160),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  postalCode: z.string().max(20).nullable(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  source: z.enum(['city', 'postal']),
});
export const locationSearchResponseSchema = z.object({ results: z.array(locationSuggestionSchema).max(8) });
export const locationTimezoneResponseSchema = z.object({ timeZone: z.string().min(1).max(64) });
export const locationReverseResponseSchema = z.object({ place: locationSuggestionSchema.nullable() });
export type LocationSuggestion = z.infer<typeof locationSuggestionSchema>;
