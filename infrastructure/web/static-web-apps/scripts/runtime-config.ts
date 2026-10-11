/**
 * Builds the web SPA's runtime configuration (`/config.json`) for one environment from `MVS_*` environment variables.
 * Values come from the environment's committed settings file (environments/<name>.env, loaded by deploy.sh), and a
 * non-empty variable of the same name (e.g. a GitHub variable) overrides the file. The result is validated with the
 * same schema the app uses at startup, so a deployment can never publish a configuration the app would reject.
 *
 * Everything here is delivered to browsers and is PUBLIC. Unknown `MVS_*` variables are rejected, which catches typos
 * and stops anyone wiring a secret (e.g. MVS_AUTH_CLIENT_SECRET) into the page.
 */
import { defaultApiEndpoints } from '@myvedicstar/api-client';
import { type AppConfig, featureFlagNames, parseAppConfig } from '@myvedicstar/config';

type Env = Readonly<Record<string, string | undefined>>;

/** Every variable the renderer understands. */
const RUNTIME_CONFIG_VARIABLES = {
  MVS_ENVIRONMENT: 'development | test | production (also uat, staging)',
  MVS_SITE_URL: 'Public origin of this environment, e.g. https://www.example.com (default for redirect URIs)',
  MVS_API_BASE_URL: 'Backend base URL including the version prefix, e.g. https://api.example.com/api/v1',
  MVS_API_TIMEOUT_MS: 'Optional request timeout (1000–120000)',
  MVS_API_ENDPOINT_PREFIX:
    'Optional path prefixed to every default endpoint, e.g. /myvedicday/api/v1 (gateway route)',
  MVS_API_ENDPOINTS: 'Optional JSON object of endpoint path overrides, e.g. {"panchangToday":"/v2/today"}',
  MVS_DEFAULT_TRADITION: 'Optional default tradition key (default "all")',
  MVS_AUTH_MODE: 'disabled | entra-external-id (default disabled)',
  MVS_AUTH_AUTHORITY: 'Entra External ID authority, https://<subdomain>.ciamlogin.com/',
  MVS_AUTH_TENANT_ID: 'Optional directory (tenant) ID of the external tenant',
  MVS_AUTH_CLIENT_ID: 'Application (client) ID of the web SPA registration',
  MVS_AUTH_API_CLIENT_ID: 'Optional application (client) ID of the API registration',
  MVS_AUTH_API_SCOPES: 'Space/comma separated API scopes (default api://<API client ID>/access_as_user)',
  MVS_AUTH_REDIRECT_URI: 'Optional (default <MVS_SITE_URL>/auth/callback)',
  MVS_AUTH_POST_LOGOUT_REDIRECT_URI: 'Optional (default <MVS_SITE_URL>/)',
  MVS_AUTH_PROVIDERS: 'Optional comma separated: email, google, apple, facebook (default email)',
  MVS_FEATURE_FLAGS: `Optional comma separated flags to enable, or name=true|false pairs (${featureFlagNames.join(', ')})`,
  MVS_TELEMETRY_ENABLED: 'true | false (default false)',
  MVS_TELEMETRY_SAMPLE_RATE: 'Optional fraction of sessions sampled, 0–1 (default 1)',
  MVS_APPINSIGHTS_CONNECTION_STRING: 'Optional Application Insights connection string (public by design)',
} as const;

type RuntimeConfigVariable = keyof typeof RUNTIME_CONFIG_VARIABLES;

type RenderResult =
  | { ok: true; raw: Record<string, unknown>; config: AppConfig; siteUrl: string }
  | { ok: false; issues: string[] };

/** GitHub Actions expands unset variables to '' — treat blank as unset. */
function read(env: Env, name: RuntimeConfigVariable): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function list(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items?.length ? items : undefined;
}

export function renderRuntimeConfig(env: Env): RenderResult {
  const issues: string[] = [];

  for (const name of Object.keys(env)) {
    if (name.startsWith('MVS_') && !name.startsWith('MVS_DEV_') && !(name in RUNTIME_CONFIG_VARIABLES)) {
      issues.push(`${name}: unknown variable (runtime config is public; secrets never belong here)`);
    }
  }

  const required = (name: RuntimeConfigVariable) => {
    const value = read(env, name);
    if (!value) issues.push(`${name}: required`);
    return value ?? '';
  };

  const siteUrl = required('MVS_SITE_URL').replace(/\/+$/, '');
  if (siteUrl) {
    try {
      const url = new URL(siteUrl);
      if (url.pathname !== '/' || url.search || url.hash) issues.push('MVS_SITE_URL: must be an origin only');
    } catch {
      issues.push('MVS_SITE_URL: not a valid URL');
    }
  }

  const raw: Record<string, unknown> = {
    environment: required('MVS_ENVIRONMENT'),
    apiBaseUrl: required('MVS_API_BASE_URL'),
  };

  const timeout = read(env, 'MVS_API_TIMEOUT_MS');
  if (timeout) raw.apiTimeoutMs = Number(timeout);

  // A gateway route prefix (e.g. API Management `/<api>/v1`) applies to every default endpoint; MVS_API_ENDPOINTS then
  // overrides individual endpoints, e.g. one served by a different API behind the same gateway.
  const prefix = read(env, 'MVS_API_ENDPOINT_PREFIX')?.replace(/\/+$/, '');
  if (prefix && (!prefix.startsWith('/') || prefix.startsWith('//'))) {
    issues.push('MVS_API_ENDPOINT_PREFIX: must be a path starting with "/", e.g. /myvedicday/api/v1');
  }
  const endpoints: Record<string, unknown> = prefix
    ? Object.fromEntries(
        Object.entries(defaultApiEndpoints).map(([name, path]) => [name, `${prefix}${path}`]),
      )
    : {};
  const overrides = read(env, 'MVS_API_ENDPOINTS');
  if (overrides) {
    try {
      Object.assign(endpoints, JSON.parse(overrides));
    } catch {
      issues.push('MVS_API_ENDPOINTS: not valid JSON');
    }
  }
  if (Object.keys(endpoints).length) raw.endpoints = endpoints;

  const tradition = read(env, 'MVS_DEFAULT_TRADITION');
  if (tradition) raw.defaultTradition = tradition;

  const authMode = read(env, 'MVS_AUTH_MODE') ?? 'disabled';
  if (authMode === 'disabled') {
    raw.auth = { mode: 'disabled' };
  } else if (authMode === 'entra-external-id') {
    const apiClientId = read(env, 'MVS_AUTH_API_CLIENT_ID');
    const scopes =
      list(read(env, 'MVS_AUTH_API_SCOPES')) ??
      (apiClientId ? [`api://${apiClientId}/access_as_user`] : undefined);
    if (!scopes) issues.push('MVS_AUTH_API_SCOPES: required (or set MVS_AUTH_API_CLIENT_ID)');
    raw.auth = {
      mode: 'entra-external-id',
      authority: required('MVS_AUTH_AUTHORITY'),
      ...(read(env, 'MVS_AUTH_TENANT_ID') ? { tenantId: read(env, 'MVS_AUTH_TENANT_ID') } : {}),
      clientId: required('MVS_AUTH_CLIENT_ID'),
      ...(apiClientId ? { apiClientId } : {}),
      apiScopes: scopes ?? [],
      redirectUri: read(env, 'MVS_AUTH_REDIRECT_URI') ?? `${siteUrl}/auth/callback`,
      postLogoutRedirectUri: read(env, 'MVS_AUTH_POST_LOGOUT_REDIRECT_URI') ?? `${siteUrl}/`,
      providers: list(read(env, 'MVS_AUTH_PROVIDERS')) ?? ['email'],
    };
  } else {
    issues.push('MVS_AUTH_MODE: must be "disabled" or "entra-external-id" for a deployed environment');
  }

  const flags = list(read(env, 'MVS_FEATURE_FLAGS'));
  if (flags) {
    raw.featureFlags = Object.fromEntries(
      flags.map((entry) => {
        const [name = '', value = 'true'] = entry.split('=');
        if (value !== 'true' && value !== 'false')
          issues.push(`MVS_FEATURE_FLAGS: ${name} must be true or false`);
        return [name, value === 'true'];
      }),
    );
  }

  const telemetryEnabled = read(env, 'MVS_TELEMETRY_ENABLED') ?? 'false';
  if (telemetryEnabled !== 'true' && telemetryEnabled !== 'false') {
    issues.push('MVS_TELEMETRY_ENABLED: must be true or false');
  }
  const connectionString = read(env, 'MVS_APPINSIGHTS_CONNECTION_STRING');
  const sampleRate = read(env, 'MVS_TELEMETRY_SAMPLE_RATE');
  raw.telemetry = {
    enabled: telemetryEnabled === 'true',
    ...(connectionString ? { connectionString } : {}),
    ...(sampleRate ? { sampleRate: Number(sampleRate) } : {}),
  };
  if (telemetryEnabled === 'true' && !connectionString) {
    issues.push('MVS_APPINSIGHTS_CONNECTION_STRING: required when MVS_TELEMETRY_ENABLED=true');
  }

  const parsed = parseAppConfig(raw);
  if (!parsed.ok) issues.push(...parsed.issues.map((issue) => `config.json ${issue}`));
  if (issues.length || !parsed.ok) return { ok: false, issues };

  if (parsed.config.auth.mode === 'entra-external-id') {
    const site = new URL(siteUrl).origin;
    for (const [field, value] of [
      ['MVS_AUTH_REDIRECT_URI', parsed.config.auth.redirectUri],
      ['MVS_AUTH_POST_LOGOUT_REDIRECT_URI', parsed.config.auth.postLogoutRedirectUri],
    ] as const) {
      if (new URL(value).origin !== site) issues.push(`${field}: must be on MVS_SITE_URL (${site})`);
    }
  }
  if (
    new URL(siteUrl).protocol !== 'https:' &&
    !['local', 'development', 'test'].includes(parsed.config.environment)
  ) {
    issues.push('MVS_SITE_URL: must use HTTPS');
  }
  return issues.length ? { ok: false, issues } : { ok: true, raw, config: parsed.config, siteUrl };
}
