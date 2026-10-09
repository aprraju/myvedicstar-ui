import { z } from 'zod';

/** Tradition keys follow the backend pattern; the list itself comes from `GET /api/v1/traditions`. */
export const traditionKeySchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9-]{0,31}$/, { error: 'tradition.invalid' });

/** BCP 47 language tag, e.g. `en`, `te`, `hi-IN`. */
export const languageTagSchema = z
  .string()
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, { error: 'language.invalid' });

/** Local calendar date `yyyy-MM-dd` within the backend's supported range. */
export const localDateSchema = z.iso
  .date({ error: 'date.invalid' })
  .refine((value) => value >= '1900-01-01' && value <= '2100-12-31', { error: 'date.outOfRange' });

export const dateRangeSchema = z
  .object({ start: localDateSchema, end: localDateSchema })
  .refine((range) => range.start <= range.end, { error: 'date.rangeOrder', path: ['end'] });

export const appearanceSchema = z.enum(['light', 'dark', 'system']);
export type Appearance = z.infer<typeof appearanceSchema>;
