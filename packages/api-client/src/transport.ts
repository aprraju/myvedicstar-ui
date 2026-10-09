import type { ZodType } from 'zod';

import { ApiError, errorFromResponse } from './errors';

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

/** Non-sensitive facts about a completed request, for telemetry. Never includes URLs, query strings or headers. */
export interface RequestMetrics {
  operation: string;
  method: HttpMethod;
  status: number | undefined;
  durationMs: number;
  correlationId: string;
  outcome: 'success' | 'error';
  errorKind?: ApiError['kind'];
}

export interface HttpTransportOptions {
  /** Backend origin (and optional base path) from runtime configuration, e.g. `https://api.example.com`. */
  baseUrl: string;
  timeoutMs?: number;
  /** Returns a bearer token for authenticated requests, or null. Called per request; never cached here. */
  getAccessToken?: () => Promise<string | null>;
  /** Called once per request with non-sensitive metrics. */
  onRequestComplete?: (metrics: RequestMetrics) => void;
  /** Called when the backend rejects the caller's credentials (401). */
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
  createCorrelationId?: () => string;
  now?: () => number;
}

export interface RequestOptions<T> {
  /** Stable operation name for telemetry, e.g. `panchang.today`. */
  operation: string;
  method?: HttpMethod;
  /** Path relative to `baseUrl`; placeholders must already be expanded and encoded (see `expandEndpoint`). */
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  schema: ZodType<T>;
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
  /** `optional` attaches a token when one is available; `required` fails fast without one. */
  auth?: 'none' | 'optional' | 'required';
}

export interface HttpTransport {
  request<T>(options: RequestOptions<T>): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function createHttpTransport(options: HttpTransportOptions): HttpTransport {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const createCorrelationId = options.createCorrelationId ?? defaultCorrelationId;
  const now = options.now ?? (() => Date.now());

  async function request<T>(req: RequestOptions<T>): Promise<T> {
    const method = req.method ?? 'GET';
    const correlationId = createCorrelationId();
    const started = now();
    let status: number | undefined;

    const complete = (outcome: RequestMetrics['outcome'], error?: ApiError) =>
      options.onRequestComplete?.({
        operation: req.operation,
        method,
        status,
        durationMs: now() - started,
        correlationId: error?.correlationId ?? correlationId,
        outcome,
        ...(error ? { errorKind: error.kind } : {}),
      });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      [CORRELATION_ID_HEADER]: correlationId,
    };
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';

    const auth = req.auth ?? 'none';
    if (auth !== 'none') {
      const token = (await options.getAccessToken?.()) ?? null;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else if (auth === 'required') {
        const error = new ApiError({ kind: 'authentication', correlationId });
        complete('error', error);
        throw error;
      }
    }

    // The caller may have cancelled while the token was being fetched (or renewed); don't start the request then.
    if (req.signal?.aborted) {
      const error = new ApiError({ kind: 'cancelled', correlationId });
      complete('error', error);
      throw error;
    }

    const { signal, cleanup, didTimeout } = linkSignals(
      req.signal,
      req.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    try {
      let response: Response;
      try {
        response = await fetchImpl(buildUrl(baseUrl, req.path, req.query), {
          method,
          headers,
          ...(req.body === undefined ? {} : { body: JSON.stringify(req.body) }),
          signal,
          credentials: 'omit',
          redirect: 'error',
        });
      } catch (cause) {
        throw new ApiError({
          kind: didTimeout() ? 'timeout' : req.signal?.aborted ? 'cancelled' : 'network',
          correlationId,
          cause,
        });
      }

      status = response.status;
      const responseCorrelationId = response.headers.get(CORRELATION_ID_HEADER) ?? correlationId;

      if (!response.ok) {
        const error = await errorFromResponse(response, responseCorrelationId);
        if (error.kind === 'authentication') options.onUnauthorized?.();
        throw error;
      }

      let payload: unknown;
      try {
        // No content (204, or e.g. 202 Accepted with an empty body) → undefined; otherwise JSON.
        const text = response.status === 204 ? '' : await response.text();
        payload = text.trim() ? (JSON.parse(text) as unknown) : undefined;
      } catch (cause) {
        throw new ApiError({ kind: 'unknown', status, correlationId: responseCorrelationId, cause });
      }

      const parsed = req.schema.safeParse(payload);
      if (!parsed.success) {
        // The backend returned something the UI cannot safely display (contract drift). Do not render it.
        throw new ApiError({
          kind: 'unknown',
          status,
          correlationId: responseCorrelationId,
          cause: parsed.error,
        });
      }

      complete('success');
      return parsed.data;
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError({ kind: 'unknown', status, correlationId, cause: error });
      complete('error', apiError);
      throw apiError;
    } finally {
      cleanup();
    }
  }

  return { request };
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.append(key, String(value));
  }
  const qs = search.toString();
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
}

/** Combines a caller's AbortSignal with a timeout, without relying on `AbortSignal.any` (not on every runtime). */
function linkSignals(external: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(external?.reason);
  if (external?.aborted) controller.abort(external.reason);
  else external?.addEventListener('abort', onAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

/** A log-safe identifier matching the backend's `^[A-Za-z0-9._-]{1,64}$`. Not a security token. */
function defaultCorrelationId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID().replace(/-/g, '');
  let id = '';
  for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}
