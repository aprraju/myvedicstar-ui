import { describe, expect, it } from 'vitest';

import {
  applicationInsightsSettings,
  entraIssuer,
  externalOrigins,
  isFeatureEnabled,
  parseAppConfig,
  parseApplicationInsightsConnectionString,
  sanitizeReturnPath,
} from './index';

const valid = { environment: 'production', apiBaseUrl: 'https://api.myvedicstar.example' };

describe('parseAppConfig', () => {
  it('applies safe defaults', () => {
    const result = parseAppConfig(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.auth).toEqual({ mode: 'disabled' });
    expect(result.config.apiTimeoutMs).toBe(15_000);
    expect(isFeatureEnabled(result.config, 'goodTime')).toBe(false);
  });

  it('requires HTTPS outside local development', () => {
    expect(parseAppConfig({ ...valid, apiBaseUrl: 'http://api.example.com' }).ok).toBe(false);
    expect(parseAppConfig({ environment: 'local', apiBaseUrl: 'http://localhost:5275/api/v1' }).ok).toBe(
      true,
    );
    expect(
      parseAppConfig({ environment: 'development', apiBaseUrl: 'http://localhost:5275/api/v1' }).ok,
    ).toBe(true);
    expect(
      parseAppConfig({ environment: 'development', apiBaseUrl: 'http://dev-api.example.com/api/v1' }).ok,
    ).toBe(false);
    expect(parseAppConfig({ environment: 'staging', apiBaseUrl: 'http://localhost:5275/api/v1' }).ok).toBe(
      false,
    );
    expect(parseAppConfig({ environment: 'production', apiBaseUrl: 'http://localhost:5275' }).ok).toBe(false);
  });

  it('rejects unknown keys so misplaced secrets are noticed', () => {
    const result = parseAppConfig({ ...valid, clientSecret: 'shh' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join()).not.toContain('shh');
  });

  it('accepts OIDC configuration with enabled providers', () => {
    const result = parseAppConfig({
      ...valid,
      auth: {
        mode: 'oidc',
        authority: 'https://tenant.ciamlogin.com/tenant.onmicrosoft.com',
        clientId: '00000000-0000-0000-0000-000000000000',
        scopes: ['api://myvedicday/Panchang.Read'],
        providers: ['email', 'google'],
      },
      featureFlags: { goodTime: true },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.auth.mode === 'oidc' && result.config.auth.redirectPath).toBe('/auth/callback');
    expect(isFeatureEnabled(result.config, 'goodTime')).toBe(true);
    expect(isFeatureEnabled(result.config, 'premium')).toBe(false);
  });

  it('defaults OIDC to session token storage and sign-up for Register', () => {
    const result = parseAppConfig({
      ...valid,
      auth: {
        mode: 'oidc',
        authority: 'https://tenant.ciamlogin.com/tenant.onmicrosoft.com',
        clientId: 'client',
        scopes: ['openid'],
        providers: ['google'],
        providerParams: { google: { domain_hint: 'google.com' } },
      },
    });
    expect(result.ok && result.config.auth).toMatchObject({
      tokenStorage: 'session',
      registerParams: { prompt: 'create' },
      providerParams: { google: { domain_hint: 'google.com' } },
    });
  });

  it('rejects localStorage token storage and an http authority', () => {
    const base = { mode: 'oidc', clientId: 'c', scopes: ['openid'], providers: ['email'] };
    expect(
      parseAppConfig({ ...valid, auth: { ...base, authority: 'https://id.example', tokenStorage: 'local' } })
        .ok,
    ).toBe(false);
    expect(parseAppConfig({ ...valid, auth: { ...base, authority: 'http://id.example' } }).ok).toBe(false);
  });

  it('allows mock authentication only in local and test environments', () => {
    expect(parseAppConfig({ ...valid, auth: { mode: 'mock' } }).ok).toBe(false);
    expect(
      parseAppConfig({ environment: 'test', apiBaseUrl: 'http://localhost:5275', auth: { mode: 'mock' } }).ok,
    ).toBe(true);
  });

  it('fills API endpoints from the defaults and applies overrides', () => {
    const result = parseAppConfig({ ...valid, endpoints: { panchangToday: '/v2/panchang/today' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.endpoints.panchangToday).toBe('/v2/panchang/today');
    expect(result.config.endpoints.panchangMonth).toBe('/panchang/month/{year}/{month}');
    expect(result.config.endpoints.locationsResolve).toBe('/locations/resolve');
  });

  it.each([
    [{ panchangToday: 'https://evil.example/today' }, 'panchangToday'],
    [{ panchangToday: '//evil.example/today' }, 'panchangToday'],
    [{ panchangToday: '/../admin' }, 'panchangToday'],
    [{ panchangMonth: '/panchang/month/{year}' }, 'panchangMonth'],
    [{ panchangDate: '/panchang/{date}/{extra}' }, 'panchangDate'],
    [{ panchangTodya: '/panchang/today' }, 'panchangTodya'],
  ])('rejects unsafe or malformed endpoint %j', (endpoints, field) => {
    const result = parseAppConfig({ ...valid, endpoints });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join('\n')).toContain(field);
  });

  it('rejects unknown feature flags', () => {
    expect(parseAppConfig({ ...valid, featureFlags: { teleport: true } }).ok).toBe(false);
  });
});

describe('sanitizeReturnPath (open redirect protection)', () => {
  it.each(['/dashboard', '/calendar/2026-09-29', '/festivals?region=south#top'])('allows %s', (path) => {
    expect(sanitizeReturnPath(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'data:text/html,hi',
    '/\tevil',
    '',
    null,
    undefined,
    'dashboard',
  ])('rejects %s', (path) => {
    expect(sanitizeReturnPath(path)).toBe('/dashboard');
  });
});

describe('Microsoft Entra External ID configuration', () => {
  const entra = {
    mode: 'entra-external-id',
    authority: 'https://myvedicstar.ciamlogin.com/',
    tenantId: '11111111-2222-3333-4444-555555555555',
    clientId: 'web-client-id',
    apiClientId: 'api-client-id',
    apiScopes: ['api://api-client-id/access_as_user'],
    redirectUri: 'https://www.myvedicstar.com/auth/callback',
    postLogoutRedirectUri: 'https://www.myvedicstar.com/',
  };

  it('accepts a complete configuration and applies defaults', () => {
    const result = parseAppConfig({ ...valid, auth: entra });
    expect(result.ok).toBe(true);
    if (!result.ok || result.config.auth.mode !== 'entra-external-id') return;
    expect(result.config.auth.providers).toEqual(['email']);
  });

  it('names every template placeholder that was not filled in, without echoing values', () => {
    const result = parseAppConfig({
      ...valid,
      auth: { ...entra, clientId: '<MYVEDICSTAR_WEB_CLIENT_ID>', apiScopes: ['api://<API>/access_as_user'] },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join('\n')).toMatch(/auth\.clientId: replace the <…> placeholder/);
    expect(result.issues.join('\n')).toMatch(/auth\.apiScopes\.0/);
    expect(result.issues.join('\n')).not.toContain('MYVEDICSTAR_WEB_CLIENT_ID');
  });

  it('rejects the tenant domain name as authority and points to the ciamlogin endpoint', () => {
    const result = parseAppConfig({
      ...valid,
      auth: { ...entra, authority: 'https://mvs.onmicrosoft.com/' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join('\n')).toMatch(/auth\.authority: use the sign-in endpoint .*ciamlogin\.com/);
    }
  });

  it('requires an HTTPS authority', () => {
    expect(parseAppConfig({ ...valid, auth: { ...entra, authority: 'http://x.ciamlogin.com/' } }).ok).toBe(
      false,
    );
  });

  it('allows http://localhost redirects only in developer environments', () => {
    const local = { ...entra, redirectUri: 'http://localhost:5173/auth/callback' };
    expect(parseAppConfig({ ...valid, auth: local }).ok).toBe(false);
    expect(
      parseAppConfig({ environment: 'development', apiBaseUrl: 'http://localhost:5275', auth: local }).ok,
    ).toBe(true);
    expect(parseAppConfig({ environment: 'uat', apiBaseUrl: 'https://api.example', auth: local }).ok).toBe(
      false,
    );
  });

  it('accepts the mobile custom-scheme redirect URI', () => {
    const mobile = { ...entra, redirectUri: 'myvedicstar://auth/callback' };
    expect(parseAppConfig({ ...valid, auth: mobile }).ok).toBe(true);
  });

  it('never allows mock authentication in UAT', () => {
    expect(
      parseAppConfig({ environment: 'uat', apiBaseUrl: 'https://api.example', auth: { mode: 'mock' } }).ok,
    ).toBe(false);
  });

  it.each([
    [{ authority: 'https://mvs.ciamlogin.com/', tenantId: 'tid' }, 'https://mvs.ciamlogin.com/tid/v2.0'],
    [{ authority: 'https://mvs.ciamlogin.com/' }, 'https://mvs.ciamlogin.com/mvs.onmicrosoft.com/v2.0'],
    [{ authority: 'https://mvs.ciamlogin.com/tid' }, 'https://mvs.ciamlogin.com/tid/v2.0'],
    [{ authority: 'https://mvs.ciamlogin.com/tid/v2.0/' }, 'https://mvs.ciamlogin.com/tid/v2.0'],
  ])('derives the OpenID Connect issuer from %o', (auth, issuer) => {
    expect(entraIssuer(auth)).toBe(issuer);
  });
});

describe('Application Insights telemetry configuration', () => {
  const connectionString =
    'InstrumentationKey=00000000-1111-2222-3333-444444444444;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/';

  it('accepts a connection string and exposes the ingestion endpoint only when enabled', () => {
    const disabled = parseAppConfig({ ...valid, telemetry: { enabled: false, connectionString } });
    expect(disabled.ok && applicationInsightsSettings(disabled.config)).toBeUndefined();

    const enabled = parseAppConfig({
      ...valid,
      telemetry: { enabled: true, connectionString, sampleRate: 0.5 },
    });
    expect(enabled.ok).toBe(true);
    if (!enabled.ok) return;
    expect(applicationInsightsSettings(enabled.config)).toEqual({
      instrumentationKey: '00000000-1111-2222-3333-444444444444',
      ingestionEndpoint: 'https://eastus-8.in.applicationinsights.azure.com/',
    });
    expect(externalOrigins(enabled.config)).toContain('https://eastus-8.in.applicationinsights.azure.com');
  });

  it.each([
    'DefaultEndpointsProtocol=https;AccountName=x;AccountKey=abc123;EndpointSuffix=core.windows.net',
    'Endpoint=sb://x.servicebus.windows.net/;SharedAccessKeyName=k;SharedAccessKey=abc123',
    'InstrumentationKey=not-a-guid',
    'InstrumentationKey=00000000-1111-2222-3333-444444444444;IngestionEndpoint=http://insecure.example/',
  ])('rejects %s without echoing it', (bad) => {
    const result = parseAppConfig({ ...valid, telemetry: { enabled: true, connectionString: bad } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join('\n')).toMatch(/telemetry\.connectionString/);
      expect(result.issues.join('\n')).not.toContain('abc123');
    }
  });

  it('derives the sovereign-cloud ingestion endpoint from EndpointSuffix', () => {
    const result = parseApplicationInsightsConnectionString(
      'InstrumentationKey=00000000-1111-2222-3333-444444444444;EndpointSuffix=applicationinsights.us',
    );
    expect(result).toEqual({
      ok: true,
      settings: {
        instrumentationKey: '00000000-1111-2222-3333-444444444444',
        ingestionEndpoint: 'https://dc.applicationinsights.us/',
      },
    });
  });
});

describe('externalOrigins', () => {
  it('lists the API and identity authority origins once each', () => {
    const result = parseAppConfig({
      environment: 'production',
      apiBaseUrl: 'https://api.myvedicstar.example/api/v1',
      auth: {
        mode: 'entra-external-id',
        authority: 'https://mvs.ciamlogin.com/',
        clientId: 'web',
        apiScopes: ['api://api/access_as_user'],
        redirectUri: 'https://www.myvedicstar.example/auth/callback',
        postLogoutRedirectUri: 'https://www.myvedicstar.example/',
      },
    });
    expect(result.ok && externalOrigins(result.config)).toEqual([
      'https://api.myvedicstar.example',
      'https://mvs.ciamlogin.com',
    ]);
  });
});

describe('unparsable URLs', () => {
  it('are reported as issues, never thrown, and never echoed', () => {
    const result = parseAppConfig({ environment: 'production', apiBaseUrl: 'https://<API_HOST>/api/v1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join('\n')).toMatch(/apiBaseUrl/);
      expect(result.issues.join('\n')).not.toContain('API_HOST');
    }
  });
});

describe('telemetry.console (local diagnostics)', () => {
  it('defaults to off and is allowed in developer environments', () => {
    const fallback = parseAppConfig(valid);
    expect(fallback.ok && fallback.config.telemetry.console).toBe(false);
    for (const environment of ['local', 'development', 'test']) {
      const result = parseAppConfig({
        environment,
        apiBaseUrl: 'http://localhost:5275/api/v1',
        telemetry: { console: true },
      });
      expect(result.ok && result.config.telemetry.console).toBe(true);
    }
  });

  it.each(['uat', 'staging', 'production'])('is rejected in %s', (environment) => {
    const result = parseAppConfig({
      environment,
      apiBaseUrl: 'https://api.example',
      telemetry: { console: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join('\n')).toMatch(/telemetry\.console/);
  });
});
