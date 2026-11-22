import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliRemediesSection } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type RemediesStatus = 'loading' | 'ready' | 'error';

export interface RemediesState {
  status: RemediesStatus;
  section: KundaliRemediesSection | null;
  errorKind: ReturnType<typeof errorKindOf> | null;
  reload: () => void;
}

function errorKindOf(error: unknown) {
  return isApiError(error) ? error.kind : 'unknown';
}

/**
 * Reads the KUN-16 remedy section for one owned Astro Profile.
 *
 * Same contract as the other Kundali hooks: the server is the only source of values, the cache key includes the user as
 * well as the profile, and nothing here computes or invents a remedy. The catalogue version is part of the payload and
 * is rendered, so a cached response cannot be presented as current under a different catalogue without saying so.
 *
 * This hook deliberately does NOT filter by status. Filtering is the render rule, and it lives beside the contract in
 * `remediesThatMayRender` where a test can reach it; a hook that silently dropped entries would make the count of
 * suppressed items unreportable.
 */
export function useRemedies(profileId: string | null): RemediesState {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.remedies(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.remedies(profileId as string, { signal }),
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
      errorKind: errorKindOf(query.error),
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
