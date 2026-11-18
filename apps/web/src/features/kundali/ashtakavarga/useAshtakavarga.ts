import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliAshtakavarga } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type AshtakavargaStatus = 'loading' | 'ready' | 'error';

export interface AshtakavargaState {
  status: AshtakavargaStatus;
  /** The payload exactly as returned. The client never recomputes, totals or interpolates a bindu. */
  ashtakavarga: KundaliAshtakavarga | null;
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads KUN-11 Ashtakavarga for one owned Astro Profile.
 *
 * The API client validates the payload, including the reconciliation invariant (sum of bhinna per sign equals sarva).
 * A payload that fails it arrives here as an `error`, never as a chart: showing numbers that do not add up would be
 * showing a wrong answer, not a layout glitch.
 */
export function useAshtakavarga(profileId: string | null): AshtakavargaState {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.ashtakavarga(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.ashtakavarga(profileId as string, { signal }),
    enabled: profileId !== null && userId !== null && config !== undefined,
  });

  if (profileId === null || userId === null) {
    return { status: 'loading', ashtakavarga: null, errorKind: null, reload: () => undefined };
  }

  if (query.isPending) {
    return { status: 'loading', ashtakavarga: null, errorKind: null, reload: () => void query.refetch() };
  }

  if (query.isError) {
    return {
      status: 'error',
      ashtakavarga: null,
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload: () => void query.refetch(),
    };
  }

  return {
    status: 'ready',
    ashtakavarga: query.data ?? null,
    errorKind: null,
    reload: () => void query.refetch(),
  };
}
