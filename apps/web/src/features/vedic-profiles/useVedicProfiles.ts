import { isApiError } from '@myvedicstar/api-client';
import type { VedicProfile, VedicProfileSummary } from '@myvedicstar/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../../shared/auth/useAuth';
import { useServices } from '../../shared/services/ServicesContext';

/** Where a mutation stands. Success is only ever reported after the server answered (AC9). */
type MutationState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; profile: VedicProfile }
  | { status: 'deleted' }
  | { status: 'conflict'; profile: VedicProfile }
  | { status: 'error'; kind: string };

export interface VedicProfilesState {
  summaries: readonly VedicProfileSummary[];
  listStatus: 'loading' | 'ready' | 'error';
  listError: string | null;
  mutation: MutationState;
  reload: () => Promise<void>;
  create: (
    request: Parameters<ReturnType<typeof useServices>['api']['vedicProfiles']['create']>[0],
  ) => Promise<VedicProfile | null>;
  update: (
    id: string,
    request: Parameters<ReturnType<typeof useServices>['api']['vedicProfiles']['replace']>[1],
  ) => Promise<VedicProfile | null>;
  remove: (id: string) => Promise<boolean>;
  clearMutation: () => void;
  /** Re-reads the profile that lost the race, so the user can review before retrying. */
  refreshAfterConflict: (id: string) => Promise<VedicProfile | null>;
}

/** Maps an API failure to the localized errors.* key the UI resolves. */
function errorKind(error: unknown): string {
  return isApiError(error) ? error.kind : 'unknown';
}

/**
 * Owns the Vedic Profiles list and mutations. The server is the source of truth: after any successful mutation the
 * list is re-read, so no client state stands in for persistence (AC9).
 */
export function useVedicProfiles(): VedicProfilesState {
  const { api } = useServices();
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<readonly VedicProfileSummary[]>([]);
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState>({ status: 'idle' });
  /**
   * Guards "don't set state after unmount". The ref is re-armed in the same effect that reloads, because a discarded
   * instance must not write stale rows into a later mount's state — that is what made a second test in the same file
   * see the first test's empty list.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const userId = user?.id ?? null;

  const reload = useCallback(async () => {
    try {
      const list = await api.vedicProfiles.list();
      if (!alive.current) return;
      setSummaries(list);
      setListStatus('ready');
      setListError(null);
    } catch (error) {
      if (!alive.current) return;
      setListStatus('error');
      setListError(errorKind(error));
    }
  }, [api]);

  // Load on mount, and again whenever the signed-in account changes, so a different user never sees stale rows.
  /**
   * Load once per signed-in account. `reload` is intentionally NOT a dependency: it is recreated whenever `api`
   * changes identity, and depending on it would clear the list and refetch on every such change — which both
   * duplicates requests and can wipe rows the user is looking at. `reloadRef` keeps the latest closure instead.
   */
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  /**
   * Load once per signed-in account. `summaries` is NOT cleared up front: doing so races an in-flight first load and
   * can wipe rows that already arrived, which is why a list with data appeared blank. Status carries the loading
   * state, and a stale row from a previous account is impossible because the effect re-runs on account change.
   */
  const loadedFor = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    setListStatus('loading');
    void reloadRef.current();
  }, [userId]);

  const create = useCallback(
    async (request: Parameters<VedicProfilesState['create']>[0]) => {
      setMutation({ status: 'saving' });
      try {
        const created = await api.vedicProfiles.create(request);
        if (!alive.current) return created;
        await reload();
        setMutation({ status: 'saved', profile: created });
        return created;
      } catch (error) {
        if (!alive.current) return null;
        setMutation({ status: 'error', kind: errorKind(error) });
        return null;
      }
    },
    [api, reload],
  );

  const update = useCallback(
    async (id: string, request: Parameters<VedicProfilesState['update']>[1]) => {
      setMutation({ status: 'saving' });
      try {
        const replaced = await api.vedicProfiles.replace(id, request);
        if (!alive.current) return replaced;
        await reload();
        setMutation({ status: 'saved', profile: replaced });
        return replaced;
      } catch (error) {
        if (!alive.current) return null;
        if (isApiError(error) && error.kind === 'conflict') {
          // Never silently overwrite: keep the caller's edit and hand back the server's current version.
          const latest = await api.vedicProfiles.get(id).catch(() => null);
          if (!alive.current) return null;
          if (latest) {
            await reload();
            setMutation({ status: 'conflict', profile: latest });
            return null;
          }
        }
        setMutation({ status: 'error', kind: errorKind(error) });
        return null;
      }
    },
    [api, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      setMutation({ status: 'saving' });
      try {
        await api.vedicProfiles.remove(id);
        if (!alive.current) return true;
        await reload();
        setMutation({ status: 'deleted' });
        return true;
      } catch (error) {
        if (!alive.current) return false;
        setMutation({ status: 'error', kind: errorKind(error) });
        return false;
      }
    },
    [api, reload],
  );

  const refreshAfterConflict = useCallback(
    async (id: string) => {
      const latest = await api.vedicProfiles.get(id).catch(() => null);
      if (latest && alive.current) await reload();
      return latest;
    },
    [api, reload],
  );

  const clearMutation = useCallback(() => setMutation({ status: 'idle' }), []);

  return {
    summaries,
    listStatus,
    listError,
    mutation,
    reload,
    create,
    update,
    remove,
    clearMutation,
    refreshAfterConflict,
  };
}
