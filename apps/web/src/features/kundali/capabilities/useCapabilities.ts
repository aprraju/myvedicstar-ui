import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliCapabilities } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useServices } from '../../../shared/services/ServicesContext';

export interface CapabilitiesState {
  status: 'loading' | 'ready' | 'error';
  capabilities: KundaliCapabilities | null;
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads the published capability boundary.
 *
 * Deliberately takes no profile id and no user: the boundary is account-independent, so it must not be coupled to
 * profile loading and must not gate first paint. It is fetched once per session — the answer changes only when the
 * engine version changes, which is a deploy, not a user action.
 *
 * A failure here is not fatal: the panel renders an explained unavailable state and every other section keeps working.
 * Nothing falls back to an assumed capability list, because an assumption is exactly what this feature exists to remove.
 */
export function useCapabilities(): CapabilitiesState {
  const { api, config } = useServices();

  const query = useQuery({
    queryKey: queryKeys.kundali.capabilities(),
    queryFn: ({ signal }) => api.kundali.capabilities({ signal }),
    enabled: config !== undefined,
    // Reference data tied to an engine version: deployment-scoped by construction, not clock-scoped.
    staleTime: Number.POSITIVE_INFINITY,
  });

  const reload = () => void query.refetch();

  if (query.isPending) return { status: 'loading', capabilities: null, errorKind: null, reload };
  if (query.isError) {
    return {
      status: 'error',
      capabilities: null,
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload,
    };
  }
  return { status: 'ready', capabilities: query.data ?? null, errorKind: null, reload };
}
