import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { VarshaphalResponse } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type VarshaphalStatus = 'loading' | 'ready' | 'error';

export interface VarshaphalStateResult {
  status: VarshaphalStatus;
  /** The payload exactly as the server returned it, or null. No chart is constructed here under any circumstance. */
  response: VarshaphalResponse | null;
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads the annual chart (Varshaphal) for one owned Astro Profile.
 *
 * ui#123: the engine has no Varshaphal. Until it does, the honest answer is the server's own `unsupported` response, and
 * this hook's job is only to carry it. Note what is absent: there is no computation, no solar-return derivation, no
 * fallback chart assembled from the natal payload. A client that could build one would be inventing astrological values.
 *
 * A transport or HTTP failure stays an `error`; the server saying "I cannot compute this" is a successful response whose
 * `availability` is not `computed`. That distinction is what keeps an outage from being drawn as a capability gap.
 */
export function useVarshaphal(profileId: string | null): VarshaphalStateResult {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.varshaphal(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.varshaphal(profileId as string, { signal }),
    enabled: profileId !== null && userId !== null && config !== undefined,
  });

  if (profileId === null || userId === null) {
    return { status: 'loading', response: null, errorKind: null, reload: () => undefined };
  }

  if (query.isPending) {
    return { status: 'loading', response: null, errorKind: null, reload: () => void query.refetch() };
  }

  if (query.isError) {
    return {
      status: 'error',
      response: null,
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload: () => void query.refetch(),
    };
  }

  return {
    status: 'ready',
    response: query.data ?? null,
    errorKind: null,
    reload: () => void query.refetch(),
  };
}
