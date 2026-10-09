import { z } from 'zod';

/**
 * RFC 7807 / RFC 9457 Problem Details as produced by the backend's GlobalExceptionHandler.
 * `errors` is present for validation problems; `traceId` and `correlationId` are always added.
 */
export const problemDetailsSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
  traceId: z.string().optional(),
  correlationId: z.string().optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
