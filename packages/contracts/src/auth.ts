import { z } from 'zod';

/**
 * `POST /api/v1/auth/login` on MyVedicStar.Authorize.Api (`UserInfoResponse`): registers the bearer of an Entra External
 * ID access token if necessary, records the session's login once, and returns the user's minimal profile. `name` is the
 * stored display name (never built from first and last name). Every field but `id` may be null.
 */
export const userInfoSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
});

export type UserInfo = z.infer<typeof userInfoSchema>;
