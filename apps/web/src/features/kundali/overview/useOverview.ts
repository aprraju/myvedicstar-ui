import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliOverview } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type OverviewStatus = 'loading' | 'ready' | 'error';

export interface OverviewState {
  status: OverviewStatus;
  overview: KundaliOverview | null;
  /** ApiError kind when the request failed, so the caller can distinguish 404 / 503 / 401 without parsing text. */
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads the KUN-05 overview for one owned Astro Profile.
 *
 * The server is the only source of astrological values: this hook fetches and returns them untouched. Nothing here
 * computes, fills or repairs a field, so an absent block reaches the page absent and is rendered as unavailable.
 *
 * Caching: the key includes the signed-in user as well as the profile, so a cached overview can never be served to a
 * different account. No staleTime override is set, so the repository's single cache policy applies.
 */
export function useOverview(profileId: string | null): OverviewState {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.overview(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.overview(profileId as string, { signal }),
    // No profile selected means there is nothing to fetch; firing a request would produce a misleading 404.
    enabled: profileId !== null && userId !== null && config !== undefined,
  });

  if (profileId === null || userId === null) {
    return { status: 'loading', overview: null, errorKind: null, reload: () => undefined };
  }

  if (query.isPending) {
    return { status: 'loading', overview: null, errorKind: null, reload: () => void query.refetch() };
  }

  if (query.isError) {
    return {
      status: 'error',
      overview: null,
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload: () => void query.refetch(),
    };
  }

  return {
    status: 'ready',
    overview: query.data ?? null,
    errorKind: null,
    reload: () => void query.refetch(),
  };
}
