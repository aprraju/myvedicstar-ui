import { type ConfigResult, parseAppConfig } from '@myvedicstar/config';
import { Platform } from 'react-native';

/**
 * Builds runtime configuration from `EXPO_PUBLIC_*` variables. Metro inlines them at build time, so each must be
 * referenced literally as `process.env.EXPO_PUBLIC_…`. They ship inside the binary: never put secrets in them.
 *
 * - `EXPO_PUBLIC_ENVIRONMENT`   local | development | test | staging | production
 * - `EXPO_PUBLIC_API_BASE_URL`  backend base URL incl. version, e.g. https://api.example.com/api/v1
 * - `EXPO_PUBLIC_FEATURE_FLAGS` JSON, e.g. {"goodTime":true}
 * - `EXPO_PUBLIC_API_ENDPOINTS` optional JSON endpoint path overrides, e.g. {"panchangToday":"/panchang/today"}
 * - `EXPO_PUBLIC_AUTH`          JSON auth config (same schema as web: {"mode":"oidc","authority":…}); default disabled
 */
export function readMobileConfig(env: Record<string, string | undefined> = readEnv()): ConfigResult {
  const environment = env.EXPO_PUBLIC_ENVIRONMENT ?? 'local';
  // Android emulators reach the host machine at 10.0.2.2.
  const localApi = `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:5275/api/v1`;

  const featureFlags = parseJson(env.EXPO_PUBLIC_FEATURE_FLAGS ?? '{}');
  if (featureFlags === INVALID_JSON) {
    return { ok: false, issues: ['featureFlags: EXPO_PUBLIC_FEATURE_FLAGS is not valid JSON'] };
  }
  const endpoints = parseJson(env.EXPO_PUBLIC_API_ENDPOINTS ?? '{}');
  if (endpoints === INVALID_JSON) {
    return { ok: false, issues: ['endpoints: EXPO_PUBLIC_API_ENDPOINTS is not valid JSON'] };
  }
  const auth = parseJson(env.EXPO_PUBLIC_AUTH ?? '{"mode":"disabled"}');
  if (auth === INVALID_JSON) {
    return { ok: false, issues: ['auth: EXPO_PUBLIC_AUTH is not valid JSON'] };
  }

  return parseAppConfig({
    environment,
    apiBaseUrl:
      env.EXPO_PUBLIC_API_BASE_URL ??
      (environment === 'local' || environment === 'development' ? localApi : undefined),
    endpoints,
    featureFlags,
    auth,
  });
}

const INVALID_JSON = Symbol('invalid-json');

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return INVALID_JSON;
  }
}

function readEnv(): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_FEATURE_FLAGS: process.env.EXPO_PUBLIC_FEATURE_FLAGS,
    EXPO_PUBLIC_API_ENDPOINTS: process.env.EXPO_PUBLIC_API_ENDPOINTS,
    EXPO_PUBLIC_AUTH: process.env.EXPO_PUBLIC_AUTH,
  };
}
