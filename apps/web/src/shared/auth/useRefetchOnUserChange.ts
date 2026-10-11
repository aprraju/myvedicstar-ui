import { removeUserCache } from '@myvedicstar/query-cache';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from './useAuth';

/**
 * Query keys switch identity on sign-in, sign-out and account changes. Remove the former account's requests and
 * results while retaining public data and independent location/date caches for the current identity.
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
      // Leave the new user's in-flight requests alone.
      if (previous.current !== null) {
        void removeUserCache(queryClient, previous.current);
      }
    }
    previous.current = userId;
  }, [userId, queryClient]);
}
