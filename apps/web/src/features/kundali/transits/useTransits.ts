import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliTransitsSection } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type TransitsStatus = 'loading' | 'ready' | 'error';

export interface TransitsState {
  status: TransitsStatus;
  section: KundaliTransitsSection | null;
  errorKind: ReturnType<typeof errorKindOf> | null;
  reload: () => void;
}

function errorKindOf(error: unknown) {
  return isApiError(error) ? error.kind : 'unknown';
}

/**
 * Reads the KUN-13 transit section for one owned Astro Profile.
 *
 * Same contract as the other Kundali hooks: the server is the only source of values, the cache key includes the user as
 * well as the profile, and nothing here computes a position or a window. A null `saturn`, `jupiter` or `sadeSati`
 * is passed through untouched - this hook has no business turning an absent graha into a default one.
 */
export function useTransits(profileId: string | null): TransitsState {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.transits(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.transits(profileId as string, { signal }),
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
