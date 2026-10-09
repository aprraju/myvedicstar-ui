import { type ProblemDetails, problemDetailsSchema } from '@myvedicstar/contracts';

/**
 * Application-level error kinds. UI code switches on `kind` to pick a friendly, localized message
 * (`errors.<kind>` in @myvedicstar/localization) — never on status codes or server text.
 */
export type ApiErrorKind =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'notFound'
  | 'rateLimit'
  | 'network'
  | 'timeout'
  | 'server'
  | 'cancelled'
  | 'unknown';

export interface ApiErrorInit {
  kind: ApiErrorKind;
  status?: number | undefined;
  correlationId?: string | undefined;
  /** Field → messages, for validation problems. Keys follow the backend's parameter names. */
  fieldErrors?: Readonly<Record<string, readonly string[]>> | undefined;
  /** Consumer-facing detail from a 422 business-rule problem (e.g. no sunrise during polar night). */
  detail?: string | undefined;
  retryAfterMs?: number | undefined;
  cause?: unknown;
}

/**
 * The single error type thrown by the API client. Its `message` is deliberately generic: server titles, stack traces,
 * internal URLs and tokens are never copied into it, so it is safe to log and never shown raw to users.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly correlationId: string | undefined;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>> | undefined;
  readonly detail: string | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(init: ApiErrorInit) {
    super(`API request failed (${init.kind}${init.status ? ` ${init.status}` : ''})`, { cause: init.cause });
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.correlationId = init.correlationId;
    this.fieldErrors = init.fieldErrors;
    this.detail = init.detail;
    this.retryAfterMs = init.retryAfterMs;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 404) return 'notFound';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rateLimit';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** Parses `Retry-After` (seconds or HTTP date) into milliseconds; undefined when absent or invalid. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export async function errorFromResponse(
  response: Response,
  correlationId: string | undefined,
): Promise<ApiError> {
  const problem = await readProblemDetails(response);
  const status = response.status;
  return new ApiError({
    kind: kindFromStatus(status),
    status,
    correlationId: problem?.correlationId ?? correlationId,
    fieldErrors: problem?.errors,
    // Only 422 business-rule details are written for consumers by the backend; everything else stays generic.
    detail: status === 422 ? problem?.detail : undefined,
    retryAfterMs: parseRetryAfter(response.headers.get('Retry-After')),
  });
}

async function readProblemDetails(response: Response): Promise<ProblemDetails | undefined> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('json')) return undefined;
  try {
    const parsed = problemDetailsSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
