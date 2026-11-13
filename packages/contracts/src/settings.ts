import { z } from 'zod';

export const savedLocationSchema = z.object({
  locationId: z.string().uuid(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  countryCode: z.string().nullable(),
  postalCode: z.string().nullable(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  timeZone: z.string().min(1).max(64),
});
export type SavedLocation = z.infer<typeof savedLocationSchema>;
/** Wire value = persisted value (approved contract, myvedicstar#4 H3). */
export const chartStyleValues = ['north-indian', 'south-indian', 'east-indian'] as const;
export const chartStyleSchema = z.enum(chartStyleValues);
export type ChartStyle = z.infer<typeof chartStyleSchema>;
export const ayanamsaValues = ['lahiri', 'raman', 'krishnamurti', 'true-chitra'] as const;
export const ayanamsaSchema = z.enum(ayanamsaValues);
export type Ayanamsa = z.infer<typeof ayanamsaSchema>;
export const userSettingsSchema = z.object({
  defaultTradition: z.string().nullable(),
  defaultLocationId: z.string().uuid().nullable(),
  revision: z.number().int().nonnegative(),
  defaultLocation: savedLocationSchema.nullable(),
  chartStyle: chartStyleSchema,
  ayanamsa: ayanamsaSchema,
});
export type UserSettings = z.infer<typeof userSettingsSchema>;
/** The new preference fields are optional on the wire: omitted (or null) means unchanged for the API. */
export type SaveSettings = Pick<UserSettings, 'defaultTradition' | 'defaultLocationId' | 'revision'> &
  Partial<Pick<UserSettings, 'chartStyle' | 'ayanamsa'>>;
export type AddSavedLocation = Omit<SavedLocation, 'locationId'>;
