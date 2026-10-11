import { type CacheReporter, type CacheSettings, createCachingClient } from '@myvedicstar/query-cache';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Server-state cache. Retries use the api-client's single policy (transient failures of reads only);
 * mutations are never retried automatically. Panchang data is keyed by date, location, tradition and language,
 * so cached data is never shown for a different context.
 */
export function createQueryClient(settings?: CacheSettings, report?: CacheReporter): QueryClient {
  return createCachingClient(settings, report);
}
