import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliBala } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type BalaStatus = 'loading' | 'ready' | 'error';

export interface BalaState {
  status: BalaStatus;
  section: KundaliBala | null;
  /** ApiError kind, so the caller distinguishes 404 / 409 / 503 without parsing text. */
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads the KUN-12 bala section for one owned Astro Profile.
 *
 * Same contract as the other Kundali hooks: the server is the only source of values, the cache key includes the user as
 * well as the profile, and nothing here computes strength. A 409 is a stale revision and is surfaced as such rather
 * than retried into a plausible-looking number.
 */
export function useBala(profileId: string | null): BalaState {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.bala(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.bala(profileId as string, { signal }),
    enabled: profileId !== null && userId !== null && config !== undefined,
  });

  if (profileId === null || userId === null) {
    return { status: 'loading', section: null, errorKind: null, reload: () => undefined };
  }
  if (query.isPending) {
    return { status: 'loading', section: null, errorKind: null, reload: () => void query.refetch() };
  }
  if (query.isError) {
    return {
      status: 'error',
      section: null,
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload: () => void query.refetch(),
    };
  }
  return {
    status: 'ready',
    section: query.data ?? null,
    errorKind: null,
    reload: () => void query.refetch(),
  };
}
