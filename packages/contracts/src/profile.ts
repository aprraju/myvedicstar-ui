import { z } from 'zod';

export const profileFields = {
  firstName: 'First Name',
  lastName: 'Last Name',
  streetAddress: 'Street Address',
  streetAddress2: 'Street Address 2',
  country: 'Country',
  state: 'State / Province',
  city: 'City',
  postalCode: 'ZIP / Postal Code',
  email: 'Email',
  phoneNumber: 'Phone Number',
} as const;
export type ProfileField = keyof typeof profileFields;
const text = z.string().nullable();
export const userProfileSchema = z.object({
  id: z.string(),
  firstName: text,
  lastName: text,
  streetAddress: text,
  streetAddress2: text,
  country: text,
  state: text,
  city: text,
  postalCode: text,
  email: text,
  phoneNumber: text,
  revision: z.number().int().nonnegative(),
  nameSyncPending: z.boolean(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;
export type ProfileValues = Record<ProfileField, string>;
export interface ProfileUpdate {
  revision: number;
  changes: Partial<Record<ProfileField, string | null>>;
}
export const geographyOptionSchema = z.object({ code: z.string(), name: z.string() });
export const geographyOptionsSchema = z.object({ results: z.array(geographyOptionSchema) });
export type GeographyOption = z.infer<typeof geographyOptionSchema>;

export function profileValues(profile?: UserProfile): ProfileValues {
  return Object.fromEntries(
    Object.keys(profileFields).map((key) => [key, profile?.[key as ProfileField] ?? '']),
  ) as ProfileValues;
}
export function profileChanges(values: ProfileValues, original: UserProfile): ProfileUpdate {
  return {
    revision: original.revision,
    changes: Object.fromEntries(
      (Object.keys(profileFields) as ProfileField[])
        .filter((key) => values[key].trim() !== (original[key] ?? ''))
        .map((key) => [key, values[key].trim() || null]),
    ),
  };
}
