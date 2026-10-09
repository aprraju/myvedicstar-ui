import { type ApiErrorKind, isApiError } from './errors';
import type { HttpMethod } from './transport';

/**
 * The single retry policy for the app. The transport never retries on its own; TanStack Query (or another caller)
 * applies this policy to idempotent reads only. Mutations must not be retried automatically.
 */
export const MAX_RETRIES = 2;
const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set(['network', 'timeout', 'rateLimit']);
const RETRYABLE_SERVER_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

export function isIdempotent(method: HttpMethod): boolean {
  return method === 'GET' || method === 'PUT' || method === 'DELETE';
}

export function isRetryableError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (RETRYABLE_KINDS.has(error.kind)) return true;
  return error.kind === 'server' && error.status !== undefined && RETRYABLE_SERVER_STATUSES.has(error.status);
}

/** Signature matches TanStack Query's `retry` option. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && isRetryableError(error);
}

/** Exponential backoff with jitter, honouring `Retry-After`. Signature matches TanStack Query's `retryDelay`. */
export function retryDelayMs(
  failureCount: number,
  error: unknown,
  random: () => number = Math.random,
): number {
  if (isApiError(error) && error.retryAfterMs !== undefined) return Math.min(error.retryAfterMs, 30_000);
  const base = Math.min(500 * 2 ** failureCount, 8_000);
  return Math.round(base / 2 + random() * (base / 2));
}
