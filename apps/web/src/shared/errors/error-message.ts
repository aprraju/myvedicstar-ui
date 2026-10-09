import { isApiError } from '@myvedicstar/api-client';
import type { MessageKey } from '@myvedicstar/localization';

export interface UserFacingError {
  /** Friendly, localized message key — never raw server text. */
  messageKey: MessageKey;
  /** Support reference (correlation ID) users can quote; contains no sensitive data. */
  reference: string | undefined;
  /** Whether "Try again" makes sense. */
  retryable: boolean;
}

const RETRYABLE: ReadonlySet<string> = new Set(['network', 'timeout', 'server', 'rateLimit', 'unknown']);

/** Maps any thrown value to what the UI may show. */
export function toUserFacingError(error: unknown, isOnline: boolean = navigator.onLine): UserFacingError {
  if (!isOnline) return { messageKey: 'errors.network', reference: undefined, retryable: true };
  if (isApiError(error)) {
    return {
      messageKey: `errors.${error.kind}`,
      reference: error.correlationId,
      retryable: RETRYABLE.has(error.kind),
    };
  }
  return { messageKey: 'errors.generic', reference: undefined, retryable: true };
}
