import type { ProfileField, ProfileValues } from '@myvedicstar/contracts';
import { z } from 'zod';

/** Empty international address fields are allowed; geography coverage does not determine validity. */
export function validateProfile(values: ProfileValues): Partial<Record<ProfileField, string>> {
  const errors: Partial<Record<ProfileField, string>> = {};
  for (const [key, value] of Object.entries(values)) {
    const max = key === 'email' ? 320 : key === 'postalCode' ? 20 : key === 'phoneNumber' ? 40 : 256;
    if (value.trim().length > max) errors[key as ProfileField] = `Use at most ${max} characters.`;
  }
  // The API rejects clearing the display name (it is the name shown across the app and on the sign-in account).
  if (!values.displayName.trim()) errors.displayName = 'Enter a display name.';
  if (values.email.trim() && !z.email().safeParse(values.email.trim()).success)
    errors.email = 'Enter a valid email address.';
  const phone = values.phoneNumber.trim();
  if (
    phone &&
    (!/^\+?[0-9 ()\-.]+$/.test(phone) ||
      phone.replace(/\D/g, '').length < 7 ||
      phone.replace(/\D/g, '').length > 15)
  ) {
    errors.phoneNumber = 'Enter a phone number with 7–15 digits, including the country code when needed.';
  }
  const postal = values.postalCode.trim();
  if (postal && !/^[\p{L}\p{N} -]{1,20}$/u.test(postal))
    errors.postalCode = 'Use letters, numbers, spaces or hyphens.';
  if (postal && values.country === 'US' && !/^\d{5}(-\d{4})?$/.test(postal))
    errors.postalCode = 'Enter a 5-digit ZIP code or ZIP+4.';
  if (
    postal &&
    values.country === 'CA' &&
    !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(postal)
  )
    errors.postalCode = 'Enter a postal code like A1A 1A1.';
  if (postal && values.country === 'IN' && !/^[1-9]\d{5}$/.test(postal))
    errors.postalCode = 'Enter a 6-digit PIN code.';
  return errors;
}
