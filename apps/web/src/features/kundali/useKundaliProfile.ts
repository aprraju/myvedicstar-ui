import { isApiError } from '@myvedicstar/api-client';
import type { VedicProfileSummary } from '@myvedicstar/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../../shared/auth/useAuth';
import { useServices } from '../../shared/services/ServicesContext';

/**
 * Where the profile list stands. `empty` is deliberately its own success value: the zero-profile prompt must never be
 * shown because a request failed (KUN-02), so 401/403/5xx resolve to `error`, never to an empty array.
 */
type KundaliListStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface KundaliProfileState {
  status: KundaliListStatus;
  summaries: readonly VedicProfileSummary[];
  errorKind: string | null;
  reload: () => Promise<void>;
}

function errorKind(error: unknown): string {
  return isApiError(error) ? error.kind : 'unknown';
}

/**
 * Reads the owned Astro Profile summaries for the Kundali shell. The server returns only the caller's rows, so there is
 * no client-side owner filtering (KUN-01). Nothing here computes astrological values or calls the calculation engine.
 *
 * `options.enabled` is false while the profile id in the URL is still unknown, so the shell does not fire a request it
 * cannot use. It becomes true when a caller needs the list to validate a selection.
 */
export function useKundaliProfile({ enabled = true }: { enabled?: boolean } = {}): KundaliProfileState {
  const { api } = useServices();
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<readonly VedicProfileSummary[]>([]);
  const [status, setStatus] = useState<KundaliListStatus>(enabled ? 'loading' : 'ready');
  const [errorKindValue, setErrorKind] = useState<string | null>(null);

  /** Re-armed in the effect that reloads; a discarded instance must not write into a later mount's state. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setStatus('loading');
    setErrorKind(null);
    try {
      const list = await api.vedicProfiles.list();
      if (!alive.current) return;
      setSummaries(list);
      // An empty array is a real answer; a failure never reaches this branch.
      setStatus(list.length === 0 ? 'empty' : 'ready');
    } catch (error) {
      if (!alive.current) return;
      setStatus('error');
      setErrorKind(errorKind(error));
    }
  }, [api]);

  /**
   * Keep the newest closure without writing a ref during render. `reload` is not an effect dependency: it changes
   * identity whenever `api` does, and depending on it would refetch on every such change.
   */
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  const userId = user?.id ?? null;
  const loadedFor = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    void reloadRef.current();
  }, [enabled, userId]);

  return { status, summaries, errorKind: errorKindValue, reload };
}
