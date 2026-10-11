import { useQueryClient } from '@tanstack/react-query';
import { removeUserCache } from '@myvedicstar/query-cache';
import { useEffect, useRef } from 'react';

import { useAuth } from './useAuth';

/**
 * Refetches all API data when the signed-in user changes (sign-in, sign-out, session end). Data loaded before sign-in
 * completed (e.g. while the identity provider's callback was being processed) was requested anonymously; refetching
 * makes every endpoint go out again with the access token, and nothing cached for one user is shown to another.
 */
export function useRefetchOnUserChange() {
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const userId = loading ? undefined : (user?.id ?? null);
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (userId === undefined) return; // session still being restored
    if (previous.current !== undefined && previous.current !== userId) {
      // A later login, even to the same account, must complete sign-in again.
      // Remove only the previous session's profile; leave the new user's in-flight request alone.
      if (previous.current !== null) {
        void removeUserCache(queryClient, previous.current);
      }
      // Cancel first: a first load still in flight was started without the token, and invalidation alone would reuse
      // its result instead of requesting again.
      // The user's own profile (`['auth', 'userinfo', userId]`) is excluded: it is keyed by user, and re-sending that POST
      // would record the login twice.
    }
    previous.current = userId;
  }, [userId, queryClient]);
}
