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
  message: z
    .string()
    .trim()
    .min(10, { error: 'contact.messageTooShort' })
    .max(2000, { error: 'contact.messageTooLong' }),
});

export type ContactForm = z.infer<typeof contactFormSchema>;
