import { onlineManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client';
import { createElement, type ReactNode, useSyncExternalStore } from 'react';

import { persistenceBuster, shouldPersistQuery } from './persistence';
import { cachePolicies, type CacheSettings } from './policies';

/** TanStack's provider suspends query fetching until the optional cache restore finishes. */
export function CacheProvider({ client, settings, persister, children }: {
  client: QueryClient;
  settings: CacheSettings;
  persister?: Persister | undefined;
  children: ReactNode;
}) {
  if (!settings.enabled || !settings.persist || !persister) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return createElement(PersistQueryClientProvider, {
    client,
    persistOptions: {
      persister,
      buster: persistenceBuster(settings),
      maxAge: cachePolicies.persistence.maxAge,
      dehydrateOptions: {
        shouldDehydrateQuery: shouldPersistQuery,
        shouldDehydrateMutation: () => false,
      },
    },
  }, children);
}

export function useCacheOnline(): boolean {
  return useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () => onlineManager.isOnline(), () => true);
}
