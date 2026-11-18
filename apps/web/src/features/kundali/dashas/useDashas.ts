import { isApiError, queryKeys } from '@myvedicstar/api-client';
import type { DashaSystem, KundaliDashaTimeline } from '@myvedicstar/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../shared/auth/useAuth';
import { useServices } from '../../../shared/services/ServicesContext';

type DashasStatus = 'loading' | 'ready' | 'error';

export interface DashasState {
  status: DashasStatus;
  timeline: KundaliDashaTimeline | null;
  /** ApiError kind when the request failed, so 404 / 400 / 409 / 503 can each be explained without parsing text. */
  errorKind: string | null;
  reload: () => void;
}

/**
 * Reads the KUN-09 dasha timeline for one owned Astro Profile.
 *
 * The same contract as the overview and planets hooks: the server is the only source of the periods, and nothing here
 * computes, extends or repairs one. `at` is passed through untouched — `null` means "the server's now", and the
 * response echoes the instant it used, so the client never substitutes its own clock for the moment being described.
 *
 * The key carries system and instant so a timeline for one system or moment can never be served for another; a
 * change in either refetches rather than re-labelling the previous answer.
 */
export function useDashas(
  profileId: string | null,
  options: { system: DashaSystem; at: string | null },
): DashasState {
  const { api } = useServices();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.kundali.dashas(
      userId ?? 'anonymous',
      profileId ?? 'none',
      options.system,
      options.at,
    ),
    queryFn: ({ signal }) =>
      api.kundali.dashas(
        profileId as string,
        { system: options.system, at: options.at ?? undefined },
        { signal },
      ),
    // No profile selected means there is nothing to fetch; firing a request would produce a misleading 404.
    enabled: profileId !== null && userId !== null,
  });

  if (profileId === null || userId === null) {
    return { status: 'loading', timeline: null, errorKind: null, reload: () => undefined };
  }

  if (query.isPending) {
    return { status: 'loading', timeline: null, errorKind: null, reload: () => void query.refetch() };
  }

  if (query.isError) {
    return {
      status: 'error',
      timeline: null,
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload: () => void query.refetch(),
    };
  }

  return {
    status: 'ready',
    timeline: query.data ?? null,
    errorKind: null,
    reload: () => void query.refetch(),
  };
}
