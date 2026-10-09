import { z } from 'zod';

/** Optional login hint passed to the identity provider; the provider performs the real validation. */
export const emailSchema = z.email({ error: 'email.invalid' }).max(254, { error: 'email.invalid' });

export const loginHintFormSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, { error: 'email.invalid' })
    .refine((value) => value === '' || emailSchema.safeParse(value).success, { error: 'email.invalid' }),
});

export type LoginHintForm = z.infer<typeof loginHintFormSchema>;
