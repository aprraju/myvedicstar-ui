import { type AppConfig, parseAppConfig } from '@myvedicstar/config';

export const RUNTIME_CONFIG_PATH = '/config.json';

export class ConfigLoadError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid runtime configuration: ${issues.join('; ')}`);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Loads `/config.json` from the SPA's own origin. The file is written per environment at deploy time, so one build
 * artifact is promoted unchanged from development to production. It is public: never put secrets in it.
 */
export async function loadRuntimeConfig(
  // Same-origin static file, not a backend API call, so the api-client is not involved.
  // eslint-disable-next-line no-restricted-syntax
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<AppConfig> {
  const response = await fetchImpl(RUNTIME_CONFIG_PATH, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ConfigLoadError([`HTTP ${response.status} loading ${RUNTIME_CONFIG_PATH}`]);

  const result = parseAppConfig(await response.json());
  if (!result.ok) throw new ConfigLoadError(result.issues);
  return result.config;
}
