import { queryKeys } from '@myvedicstar/api-client';
import type { UserInfo } from '@myvedicstar/contracts';
import { type QueryClient, skipToken, useQuery } from '@tanstack/react-query';

/** Stores the user info returned by `POST /auth/login` (the session audit calls this once per signed-in account). */
export function seedUserInfo(client: QueryClient, userId: string, userInfo: UserInfo): void {
  client.setQueryData(queryKeys.auth.userInfo(userId), userInfo);
}

/**
 * The signed-in user's info from this session's login response. It is never fetched separately (the login endpoint
 * already returns it), so it is undefined while signed out or when the login request failed; callers fall back to the
 * sign-in token's name and email.
 */
export function useLoginUserInfo(userId: string | undefined): UserInfo | undefined {
  return useQuery<UserInfo>({
    queryKey: queryKeys.auth.userInfo(userId ?? 'signed-out'),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  }).data;
}
