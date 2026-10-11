import { retryDelayMs, shouldRetryQuery } from '@myvedicstar/api-client';
import { QueryClient, type QueryKey } from '@tanstack/react-query';

import { keyScope } from './keys';
import { cachePolicies, type CacheSettings, defaultCacheSettings } from './policies';

export interface CacheDiagnostic {
  event: 'hit' | 'miss' | 'fetch' | 'error' | 'retry' | 'invalidate' | 'count' | 'storage-error';
  family?: string;
  value?: number;
}

export type CacheReporter = (event: CacheDiagnostic) => void;

/** No query keys, inputs, response bodies, user IDs, or tokens leave this reporter. */
export function createCachingClient(
  settings: CacheSettings = defaultCacheSettings,
  report: CacheReporter = () => undefined,
): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        ...cachePolicies.default,
        ...(settings.enabled ? {} : { staleTime: 0, gcTime: 0 }),
        retry: shouldRetryQuery,
        retryDelay: retryDelayMs,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        networkMode: 'online',
      },
      mutations: { retry: false },
    },
  });
  if (settings.enabled) {
    client.setQueryDefaults(['panchang'], cachePolicies.panchang);
    client.setQueryDefaults(['panchang', 'today'], cachePolicies.today);
    client.setQueryDefaults(['panchang', 'month'], cachePolicies.calendar);
    client.setQueryDefaults(['muhurta'], cachePolicies.goodTime);
    client.setQueryDefaults(['muhurta', 'activities'], cachePolicies.catalog);
    client.setQueryDefaults(['muhurta', 'nakshatras'], cachePolicies.catalog);
    client.setQueryDefaults(['traditions'], cachePolicies.catalog);
    client.setQueryDefaults(['festivals'], cachePolicies.panchang);
  }
  const started = new Map<string, number>();
  client.getQueryCache().subscribe((event) => {
    const { query } = event;
    const family = String(query.queryKey[0]);
    if (event.type === 'added' || event.type === 'removed') {
      report({ event: 'count', value: client.getQueryCache().getAll().length });
      if (event.type === 'removed') started.delete(query.queryHash);
    }
    if (event.type === 'observerAdded') {
      report({ event: query.state.data !== undefined && !query.isStaleByTime(query.options.staleTime) ? 'hit' : 'miss', family });
    }
    if (event.type !== 'updated') return;
    if (event.action.type === 'fetch') started.set(query.queryHash, Date.now());
    if (event.action.type === 'success' || event.action.type === 'error') {
      const start = started.get(query.queryHash);
      if (start !== undefined) report({ event: event.action.type === 'error' ? 'error' : 'fetch', family, value: Date.now() - start });
      started.delete(query.queryHash);
    }
    if (event.action.type === 'failed') report({ event: 'retry', family });
    if (event.action.type === 'invalidate') report({ event: 'invalidate', family });
  });
  return client;
}

/** Removes the old account's data and cancels its requests; public caches remain available. */
export async function removeUserCache(client: QueryClient, userId: string): Promise<void> {
  const filters = {
    predicate: (query: { queryKey: QueryKey }) =>
      keyScope(query.queryKey)?.userId === userId ||
      (query.queryKey[0] === 'auth' && query.queryKey[2] === userId),
  };
  await client.cancelQueries(filters);
  client.removeQueries(filters);
}

export function invalidateCalculations(client: QueryClient, family?: 'panchang' | 'muhurta' | 'festivals') {
  return client.invalidateQueries({
    predicate: (query) => family
      ? query.queryKey[0] === family
      : ['panchang', 'muhurta', 'festivals'].includes(String(query.queryKey[0])),
  });
}
