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
export const userSettingsSchema = z.object({
  defaultTradition: z.string().nullable(),
  defaultLocationId: z.string().uuid().nullable(),
  revision: z.number().int().nonnegative(),
  defaultLocation: savedLocationSchema.nullable(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;
export type SaveSettings = Pick<UserSettings, 'defaultTradition' | 'defaultLocationId' | 'revision'>;
export type AddSavedLocation = Omit<SavedLocation, 'locationId'>;
