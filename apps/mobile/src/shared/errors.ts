import { isApiError } from '@myvedicstar/api-client';
import type { MessageKey } from '@myvedicstar/localization';

/** Friendly message key for any thrown value — never raw server or exception text. */
export function errorMessageKey(error: unknown): MessageKey {
  return isApiError(error) ? `errors.${error.kind}` : 'errors.generic';
}
