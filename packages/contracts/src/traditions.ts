import { z } from 'zod';

/** Mirrors `MyVedicDay.Api/Contracts/Traditions/TraditionsResponse.cs` (`GET /api/v1/traditions`). */
export const traditionSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export const traditionsResponseSchema = z.object({
  language: z.string(),
  traditions: z.array(traditionSummarySchema),
});

export type TraditionSummary = z.infer<typeof traditionSummarySchema>;
export type TraditionsResponse = z.infer<typeof traditionsResponseSchema>;
