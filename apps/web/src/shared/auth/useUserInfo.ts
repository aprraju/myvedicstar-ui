import type { UserInfo } from '@myvedicstar/contracts';
import { useLoginUserInfo } from '@myvedicstar/query-cache';

import { useAuth } from './useAuth';

/**
 * The signed-in user's info from this session's `POST /auth/login` response (seeded into the query cache by the auth
 * audit before the account is published, and refreshed when the profile is saved). Never requested separately.
 * Undefined while signed out or if the login request failed.
 */
export function useUserInfo(): { userInfo: UserInfo | undefined } {
  const { user } = useAuth();
  const userInfo = useLoginUserInfo(user?.id);
  return { userInfo: user ? userInfo : undefined };
}

/** Display name: the profile's display name, else first name, else the identity token's name. */
export function displayNameOf(userInfo: UserInfo | undefined, fallback?: string): string | undefined {
  const name = userInfo?.name?.trim() || userInfo?.firstName?.trim() || fallback?.trim();
  return name || undefined;
}
