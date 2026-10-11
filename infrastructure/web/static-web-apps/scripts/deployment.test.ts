import { describe, expect, it } from 'vitest';

import { renderRuntimeConfig } from './runtime-config.ts';
import { buildStaticWebAppConfig } from './static-web-app-config.ts';

const production = {
  MVS_ENVIRONMENT: 'production',
  MVS_SITE_URL: 'https://www.myvedicstar.example',
  MVS_API_BASE_URL: 'https://api.myvedicstar.example/api/v1',
  MVS_AUTH_MODE: 'entra-external-id',
  MVS_AUTH_AUTHORITY: 'https://mvs.ciamlogin.com/',
  MVS_AUTH_TENANT_ID: '11111111-2222-3333-4444-555555555555',
  MVS_AUTH_CLIENT_ID: 'web-client-id',
  MVS_AUTH_API_CLIENT_ID: 'api-client-id',
  MVS_FEATURE_FLAGS: 'goodTime, notifications=false',
  MVS_TELEMETRY_ENABLED: 'true',
  MVS_TELEMETRY_SAMPLE_RATE: '0.5',
  MVS_APPINSIGHTS_CONNECTION_STRING:
    'InstrumentationKey=00000000-1111-2222-3333-444444444444;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/',
  // Unrelated variables in the CI environment are ignored.
  PATH: '/usr/bin',
  AZURE_STATIC_WEB_APP_NAME: 'swa-name',
};

function render(env: Record<string, string>) {
  const result = renderRuntimeConfig(env);
  if (!result.ok) throw new Error(result.issues.join('\n'));
  return result;
}

describe('runtime config from environment variables', () => {
  it('validates and renders cache and location search configuration', () => {
    const result = render({ ...production, MVS_CACHE: '{"persist":true,"rulesVersion":"rules-v2"}', MVS_LOCATION_SEARCH: '{"enabled":true,"debounceMs":350}' });
    expect(result.config.cache.persist).toBe(true);
    expect(result.config.cache.rulesVersion).toBe('rules-v2');
    expect(result.config.locationSearch.enabled).toBe(true);
    expect(renderRuntimeConfig({ ...production, MVS_CACHE: '{bad' }).ok).toBe(false);
    expect(renderRuntimeConfig({ ...production, MVS_LOCATION_SEARCH: '{"username":"should-not-be-public"}' }).ok).toBe(false);
  });
  it('renders a complete production config with derived Entra values', () => {
    const { raw, config } = render(production);
    expect(raw).toEqual({
      environment: 'production',
      apiBaseUrl: 'https://api.myvedicstar.example/api/v1',
      auth: {
        mode: 'entra-external-id',
        authority: 'https://mvs.ciamlogin.com/',
        tenantId: '11111111-2222-3333-4444-555555555555',
        clientId: 'web-client-id',
        apiClientId: 'api-client-id',
        apiScopes: ['api://api-client-id/access_as_user'],
        redirectUri: 'https://www.myvedicstar.example/auth/callback',
        postLogoutRedirectUri: 'https://www.myvedicstar.example/',
        providers: ['email'],
      },
      featureFlags: { goodTime: true, notifications: false },
      telemetry: {
        enabled: true,
        connectionString: production.MVS_APPINSIGHTS_CONNECTION_STRING,
        sampleRate: 0.5,
      },
    });
    expect(config.featureFlags.goodTime).toBe(true);
  });

  it('routes every endpoint through a gateway prefix, with per-endpoint overrides for another API', () => {
    const { config } = render({
      ...production,
      MVS_API_BASE_URL: 'https://apim.example.azure-api.net',
      MVS_API_ENDPOINT_PREFIX: '/myvedicday/api/v1/',
      MVS_API_ENDPOINTS: '{"authUserInfo":"/api/v1/auth/userinfo"}',
    });
    expect(config.endpoints.panchangToday).toBe('/myvedicday/api/v1/panchang/today');
    expect(config.endpoints.panchangMonth).toBe('/myvedicday/api/v1/panchang/month/{year}/{month}');
    expect(config.endpoints.authUserInfo).toBe('/api/v1/auth/userinfo');
  });

  it('treats blank variables (unset GitHub variables) as unset', () => {
    const { raw } = render({
      MVS_ENVIRONMENT: 'development',
      MVS_SITE_URL: 'https://dev.myvedicstar.example/',
      MVS_API_BASE_URL: 'https://dev-api.myvedicstar.example/api/v1',
      MVS_AUTH_MODE: '',
      MVS_FEATURE_FLAGS: '',
      MVS_TELEMETRY_ENABLED: '',
      MVS_APPINSIGHTS_CONNECTION_STRING: '',
    });
    expect(raw).toEqual({
      environment: 'development',
      apiBaseUrl: 'https://dev-api.myvedicstar.example/api/v1',
      auth: { mode: 'disabled' },
      telemetry: { enabled: false },
    });
  });

  it.each([
    [{ MVS_AUTH_CLIENT_SECRET: 'abc123' }, /MVS_AUTH_CLIENT_SECRET: unknown variable/],
    [{ MVS_API_BASE_URL: 'http://api.myvedicstar.example/api/v1' }, /apiBaseUrl must use HTTPS/],
    [
      { MVS_AUTH_REDIRECT_URI: 'https://evil.example/auth/callback' },
      /MVS_AUTH_REDIRECT_URI: must be on MVS_SITE_URL/,
    ],
    [{ MVS_AUTH_MODE: 'mock' }, /MVS_AUTH_MODE/],
    [{ MVS_AUTH_CLIENT_ID: '' }, /MVS_AUTH_CLIENT_ID: required/],
    [{ MVS_ENVIRONMENT: 'prod' }, /environment/],
    [{ MVS_FEATURE_FLAGS: 'teleport' }, /featureFlags/],
    [{ MVS_APPINSIGHTS_CONNECTION_STRING: '' }, /required when MVS_TELEMETRY_ENABLED=true/],
    [
      { MVS_APPINSIGHTS_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=a;AccountKey=abc123' },
      /contains a secret/,
    ],
    [{ MVS_SITE_URL: 'https://www.myvedicstar.example/app' }, /MVS_SITE_URL: must be an origin only/],
    [{ MVS_API_ENDPOINT_PREFIX: '//evil.example' }, /MVS_API_ENDPOINT_PREFIX/],
  ])('rejects %o', (override, message) => {
    const result = renderRuntimeConfig({ ...production, ...override });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join('\n')).toMatch(message);
    expect(result.issues.join('\n')).not.toContain('abc123');
  });
});

describe('staticwebapp.config.json', () => {
  it('allows exactly the environment origins in CSP connect-src and sends the security headers', () => {
    const swa = buildStaticWebAppConfig(render(production).config) as {
      globalHeaders: Record<string, string>;
      navigationFallback: { rewrite: string; exclude: string[] };
      routes: { route: string; statusCode?: number; headers?: Record<string, string> }[];
    };
    const csp = swa.globalHeaders['Content-Security-Policy'];
    expect(csp).toContain(
      "connect-src 'self' https://api.myvedicstar.example https://mvs.ciamlogin.com https://eastus-8.in.applicationinsights.azure.com;",
    );
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain('unsafe-inline');
    expect(swa.globalHeaders['Strict-Transport-Security']).toMatch(/max-age=\d+/);
    expect(swa.globalHeaders['X-Content-Type-Options']).toBe('nosniff');
    expect(swa.globalHeaders['X-Robots-Tag']).toBeUndefined();

    expect(swa.navigationFallback.rewrite).toBe('/index.html');
    expect(swa.navigationFallback.exclude).toContain('/assets/*');
    const routes = swa.routes.map((route) => route.route);
    expect(routes.indexOf('/assets/*')).toBeLessThan(routes.indexOf('/*'));
    expect(routes.indexOf('/config.json')).toBeLessThan(routes.indexOf('/*'));
    expect(swa.routes.find((route) => route.route === '/.auth/login/github')?.statusCode).toBe(404);
  });

  it('keeps non-production environments out of search engines', () => {
    const { config } = render({ ...production, MVS_ENVIRONMENT: 'test' });
    const swa = buildStaticWebAppConfig(config) as { globalHeaders: Record<string, string> };
    expect(swa.globalHeaders['X-Robots-Tag']).toBe('noindex, nofollow');
  });
});
