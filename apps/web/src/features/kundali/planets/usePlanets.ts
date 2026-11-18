import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliPlanets } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type PlanetsStatus = 'loading' | 'ready' | 'error';

export interface PlanetsState {
  status: PlanetsStatus;
  section: KundaliPlanets | null;
  /** ApiError kind when the request failed, so the caller can distinguish 404 / 409 / 503 / 401 without parsing text. */
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads the KUN-08 planet section for one owned Astro Profile.
 *
 * Same contract as the overview hook: the server is the only source of astrological values, the cache key includes the
 * signed-in user as well as the profile, and nothing here computes, fills or repairs a fact. A 409 is a stale-revision
 * answer from the server and is surfaced as such, never retried into a plausible-looking result.
 */
export function usePlanets(profileId: string | null): PlanetsState {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.planets(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.planets(profileId as string, { signal }),
    // No profile selected means there is nothing to fetch; firing a request would produce a misleading 404.
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
