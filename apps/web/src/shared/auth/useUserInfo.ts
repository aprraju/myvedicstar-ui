import { queryKeys } from '@myvedicstar/api-client';
import type { UserInfo } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useServices } from '../services/ServicesContext';
import { useAuth } from './useAuth';

/**
 * The signed-in user's profile from the Authorize API (`POST /auth/userinfo`). The call also completes sign-in on the
 * backend (profile refresh, login audit), so it runs once per signed-in user and session: cached indefinitely, never
 * retried automatically. Undefined while signed out, loading, or if the service is unavailable.
 */
export function useUserInfo(): { userInfo: UserInfo | undefined; loading: boolean } {
  const { api } = useServices();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.auth.userInfo(user?.id ?? 'signed-out'),
    queryFn: ({ signal }) => api.auth.userInfo({ signal }),
    enabled: user !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
  return { userInfo: user ? query.data : undefined, loading: user !== null && query.isPending };
}

/** Display name: the profile's full name, else given name, else the identity token's name. */
export function displayNameOf(userInfo: UserInfo | undefined, fallback?: string): string | undefined {
  const name = userInfo?.name?.trim() || userInfo?.givenName?.trim() || fallback?.trim();
  return name || undefined;
}
