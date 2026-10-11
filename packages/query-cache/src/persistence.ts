import { panchangResponseSchema } from '@myvedicstar/contracts';
import { todayIn } from '@myvedicstar/date-time';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { hashKey, type Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

import type { CacheReporter } from './client';
import { keyScope } from './keys';
import { cachePolicies, type CacheSettings } from './policies';

export interface CacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function persistenceBuster(settings: CacheSettings): string {
  return `myvedicstar:${settings.schemaVersion}:${settings.rulesVersion}:${settings.calculationVersion}`;
}

/** Only anonymous Today is approved. Authenticated calculations, birth stars, profiles and mutations stay in memory. */
export function shouldPersistQuery(query: Query): boolean {
  return (
    query.state.status === 'success' &&
    query.queryKey[0] === 'panchang' &&
    query.queryKey[1] === 'today' &&
    keyScope(query.queryKey)?.userId === null &&
    JSON.stringify(query.state.data).length * 2 <= cachePolicies.persistence.maxQueryBytes
  );
}

/** Supported TanStack persister with bounded storage and validation before hydration. Failures never block API use. */
export function createCachePersister(
  storage: CacheStorage,
  settings: CacheSettings,
  report: CacheReporter = () => undefined,
): Persister {
  const guarded: CacheStorage = {
    async getItem(key) {
      try {
        return await storage.getItem(key);
      } catch {
        report({ event: 'storage-error' });
        return null;
      }
    },
    async setItem(key, value) {
      try {
        if (value.length * 2 > cachePolicies.persistence.maxTotalBytes) {
          await storage.removeItem(key);
          return;
        }
        await storage.setItem(key, value);
      } catch {
        report({ event: 'storage-error' });
      }
    },
    async removeItem(key) {
      try {
        await storage.removeItem(key);
      } catch {
        report({ event: 'storage-error' });
      }
    },
  };
  const base = createAsyncStoragePersister({
    storage: guarded,
    key: 'myvedicstar-public-query-cache',
    throttleTime: 1000,
  });
  return {
    persistClient: base.persistClient,
    removeClient: base.removeClient,
    async restoreClient(): Promise<PersistedClient | undefined> {
      try {
        const restored = await base.restoreClient();
        if (!restored) return undefined;
        const now = Date.now();
        if (
          restored.buster !== persistenceBuster(settings) ||
          !Number.isFinite(restored.timestamp) ||
          restored.timestamp > now ||
          now - restored.timestamp > cachePolicies.persistence.maxAge
        ) {
          await base.removeClient();
          return undefined;
        }
        restored.clientState.mutations = [];
        restored.clientState.queries = restored.clientState.queries.filter((query) => {
          if (
            query.queryKey[0] !== 'panchang' ||
            query.queryKey[1] !== 'today' ||
            keyScope(query.queryKey)?.userId !== null
          )
            return false;
          const scope = keyScope(query.queryKey);
          if (
            scope?.schemaVersion !== settings.schemaVersion ||
            scope.rulesVersion !== settings.rulesVersion ||
            scope.calculationVersion !== settings.calculationVersion
          )
            return false;
          if (
            query.state.status !== 'success' ||
            query.state.dataUpdatedAt > now ||
            now - query.state.dataUpdatedAt > cachePolicies.persistence.maxAge
          )
            return false;
          if (JSON.stringify(query.state.data).length * 2 > cachePolicies.persistence.maxQueryBytes)
            return false;
          const parsed = panchangResponseSchema.safeParse(query.state.data);
          if (!parsed.success) return false;
          query.state.data = parsed.data;
          const today = todayIn(parsed.data.location.timeZone);
          return (
            query.queryKey[3] === today &&
            parsed.data.localToday === today &&
            parsed.data.days.length === 1 &&
            parsed.data.days[0]?.date === today
          );
        });
        for (const query of restored.clientState.queries) query.queryHash = hashKey(query.queryKey);
        return restored;
      } catch {
        report({ event: 'storage-error' });
        await base.removeClient();
        return undefined;
      }
    },
  };
}
