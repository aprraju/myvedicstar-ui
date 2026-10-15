import { z } from 'zod';

import { emailSchema } from './identity';

/** Reasons offered on the Contact Us form (labels are localized in the UI). */
export const contactReasons = [
  'general',
  'technical',
  'panchang',
  'account',
  'privacy',
  'feedback',
  'other',
] as const;
export type ContactReason = (typeof contactReasons)[number];

/** Contact Us form. Error values are message keys under `validation.`. */
export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'contact.nameRequired' })
    .max(100, { error: 'contact.nameTooLong' }),
  email: z.string().trim().pipe(emailSchema),
  reason: z.enum(contactReasons, { error: 'contact.reasonRequired' }),
  subject: z
    .string()
    .trim()
    .min(1, { error: 'contact.subjectRequired' })
    .max(200, { error: 'contact.subjectTooLong' })
    .refine((value) => !/[\r\n\u0000-\u001f\u007f]/.test(value), { error: 'contact.subjectRequired' }),
  phoneNumber: z
    .string()
    .trim()
    .max(40, { error: 'contact.phoneInvalid' })
    .refine(
      (value) =>
        !value ||
        (/^[+0-9 ().-]+$/.test(value) &&
          (value.match(/[0-9]/g)?.length ?? 0) >= 7 &&
          (value.match(/[0-9]/g)?.length ?? 0) <= 15),
      { error: 'contact.phoneInvalid' },
    ),
  message: z
    .string()
    .trim()
    .min(10, { error: 'contact.messageTooShort' })
    .max(2000, { error: 'contact.messageTooLong' }),
});

export type ContactForm = z.infer<typeof contactFormSchema>;
