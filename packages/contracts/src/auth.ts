import { z } from 'zod';

/**
 * `POST /api/v1/auth/userinfo` on MyVedicStar.Authorize.Api (`UserInfoResponse`): completes sign-in for the bearer of an
 * Entra External ID access token and returns the user's minimal profile. Every field but `id` may be null;
 * separate given name and surname fields are optional.
 */
export const userInfoSchema = z.object({
  id: z.string(),
  givenName: z.string().nullable().optional(),
  surname: z.string().nullable().optional(),
  name: z.string().nullable(),
  email: z.string().nullable(),
});

export type UserInfo = z.infer<typeof userInfoSchema>;
