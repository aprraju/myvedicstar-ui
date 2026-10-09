import { retryDelayMs, shouldRetryQuery } from '@myvedicstar/api-client';
import { QueryClient } from '@tanstack/react-query';

/**
 * Server-state cache. Retries use the api-client's single policy (transient failures of reads only);
 * mutations are never retried automatically. Panchang data is keyed by date, location, tradition and language,
 * so cached data is never shown for a different context.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: retryDelayMs,
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
