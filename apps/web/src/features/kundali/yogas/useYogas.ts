import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { KundaliYogas } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type YogasStatus = 'loading' | 'ready' | 'error';

export interface YogasState {
  status: YogasStatus;
  /** The payload exactly as the server returned it. Nothing is filled in, defaulted or re-derived here. */
  yogas: KundaliYogas | null;
  /** ApiError kind when the request failed, so a 404 is distinguishable from a 503 without parsing text. */
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads KUN-10 assessments for one owned Astro Profile.
 *
 * A transport or HTTP failure is an `error`; the server's own "I cannot compute this" is a successful response whose
 * `availability` is `unsupported`. Keeping those apart is what stops an outage from being drawn as a finding, and a
 * finding from being hidden behind an error card.
 *
 * Caching is keyed by signed-in user and profile, so a cached assessment set can never be shown to another account.
 */
export function useYogas(profileId: string | null): YogasState {
  const { api, config } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.yogas(userId ?? 'anonymous', profileId ?? 'none'),
    queryFn: ({ signal }) => api.kundali.yogas(profileId as string, { signal }),
    enabled: profileId !== null && userId !== null && config !== undefined,
  });

  if (profileId === null || userId === null) {
    return { status: 'loading', yogas: null, errorKind: null, reload: () => undefined };
  }

  if (query.isPending) {
    return { status: 'loading', yogas: null, errorKind: null, reload: () => void query.refetch() };
  }

  if (query.isError) {
    return {
      status: 'error',
      yogas: null,
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload: () => void query.refetch(),
    };
  }

  return { status: 'ready', yogas: query.data ?? null, errorKind: null, reload: () => void query.refetch() };
}
