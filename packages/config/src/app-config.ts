import {
  type ApiEndpointName,
  type ApiEndpoints,
  defaultApiEndpoints,
  validateEndpointTemplate,
} from '@myvedicstar/api-client';
import { z } from 'zod';

// Keep Zod CSP-safe (no `new Function`); see docs/security/content-security-policy.md.
z.config({ jitless: true });

/**
 * Runtime configuration. Everything here ships to the browser or the app binary and is therefore PUBLIC:
 * never put secrets, client secrets, signing keys or instrumentation secrets in it.
 *
 * Web: loaded at startup from `/config.json` (written per environment at deploy time; build once, deploy many).
 * Mobile: built from `EXPO_PUBLIC_*` variables per EAS build profile.
 */

export const environments = ['local', 'development', 'test', 'uat', 'staging', 'production'] as const;
export type AppEnvironment = (typeof environments)[number];

/** Environments that must use HTTPS everywhere and can never enable mock authentication. */
const SECURE_ENVIRONMENTS: readonly AppEnvironment[] = ['uat', 'staging', 'production'];

export const identityProviders = ['email', 'google', 'apple', 'facebook'] as const;
export type IdentityProvider = (typeof identityProviders)[number];

export const featureFlagNames = [
  'goodTime',
  'notifications',
  'aiExplanation',
  'kundali',
  'horoscope',
  'compatibility',
  'astrology',
  'matrimony',
  'premium',
] as const;
export type FeatureFlag = (typeof featureFlagNames)[number];

const endpointNames = Object.keys(defaultApiEndpoints) as [ApiEndpointName, ...ApiEndpointName[]];

/**
 * API endpoint paths, relative to `apiBaseUrl`. Any subset may be given; the rest use the defaults (which mirror the
 * backend OpenAPI document). Unknown names are rejected so typos surface at startup.
 */
const endpointsSchema = z
  .partialRecord(z.enum(endpointNames), z.string().max(200))
  .superRefine((value, ctx) => {
    for (const [name, template] of Object.entries(value) as [ApiEndpointName, string][]) {
      const problem = validateEndpointTemplate(name, template);
      if (problem) ctx.addIssue({ code: 'custom', path: [name], message: problem });
    }
  })
  .default({})
  .transform((value): ApiEndpoints => ({ ...defaultApiEndpoints, ...value }));

const featureFlagsSchema = z
  .object(
    Object.fromEntries(featureFlagNames.map((flag) => [flag, z.boolean().default(false)])) as Record<
      FeatureFlag,
      z.ZodDefault<z.ZodBoolean>
    >,
  )
  .strict();

/** Extra authorization-request parameters, e.g. `{ "domain_hint": "google.com" }`. Names and values are public. */
const authParamsSchema = z.record(z.string().regex(/^[a-z_]{1,40}$/), z.string().max(200));

/** Rejects template values such as `<MYVEDICSTAR_WEB_CLIENT_ID>` that were copied but never filled in. */
const filled = (schema: z.ZodString) =>
  schema.refine((value) => !/[<>]/.test(value), 'replace the <…> placeholder with the value from Entra');

const authSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('disabled') }),
  z.object({
    /**
     * Microsoft Entra External ID as an OpenID Connect provider (web: oidc-client-ts; mobile: expo-auth-session).
     * Authorization code + PKCE, public client, full-page redirect; tokens in memory; refresh tokens renew silently.
     * Values come from the Entra admin center — see docs/security/entra-setup.md.
     */
    mode: z.literal('entra-external-id'),
    /** `https://<subdomain>.ciamlogin.com/` (Entra → Overview → Primary domain, without `.onmicrosoft.com`). */
    authority: filled(z.string())
      .pipe(z.url({ protocol: /^https$/ }))
      .refine(
        (value) => !tryParseUrl(value)?.hostname.endsWith('.onmicrosoft.com'),
        'use the sign-in endpoint https://<subdomain>.ciamlogin.com/, not the <subdomain>.onmicrosoft.com domain name',
      ),
    /** Directory (tenant) ID of the external tenant. Needed for standards-based discovery (mobile). */
    tenantId: filled(z.string().min(1).max(64)).optional(),
    /** Application (client) ID of THIS client's app registration (MyVedicStar-Web or MyVedicStar-Mobile). */
    clientId: filled(z.string().min(1).max(128)),
    /** Application (client) ID of MyVedicStar-API (informational; the scope below is what is requested). */
    apiClientId: filled(z.string().min(1).max(128)).optional(),
    /** Delegated API scopes, e.g. `api://<api-client-id>/access_as_user`. Access tokens are issued for these. */
    apiScopes: z.array(filled(z.string().min(1))).min(1),
    /** Must exactly match a redirect URI on the app registration (web: SPA platform). */
    redirectUri: filled(z.string()).pipe(z.url()),
    postLogoutRedirectUri: filled(z.string()).pipe(z.url()),
    providers: z.array(z.enum(identityProviders)).min(1).default(['email']),
    // Tokens are always held in memory only (no sessionStorage, localStorage or cookies) — not configurable.
  }),
  z.object({
    /** OpenID Connect authorization code flow with PKCE (e.g. Microsoft Entra External ID). Public client only. */
    mode: z.literal('oidc'),
    authority: z.url({ protocol: /^https$/ }),
    clientId: z.string().min(1).max(128),
    scopes: z.array(z.string().min(1)).min(1),
    redirectPath: z.string().startsWith('/').default('/auth/callback'),
    postLogoutRedirectPath: z.string().startsWith('/').default('/'),
    providers: z.array(z.enum(identityProviders)).min(1),
    /**
     * Where the web client keeps tokens: `session` (tab-scoped sessionStorage, survives reloads, cleared when the tab
     * closes) or `memory` (lost on reload). Never localStorage. See docs/security/authentication.md.
     */
    tokenStorage: z.enum(['session', 'memory']).default('session'),
    /** Per-provider parameters that send the user straight to that provider at the identity service. */
    providerParams: z.partialRecord(z.enum(identityProviders), authParamsSchema).default({}),
    /** Parameters for "Register" (OpenID Connect `prompt=create` asks the provider to show sign-up). */
    registerParams: authParamsSchema.default({ prompt: 'create' }),
  }),
  z.object({
    /** Local development and automated tests only: signs in instantly without an identity provider. */
    mode: z.literal('mock'),
    providers: z.array(z.enum(identityProviders)).min(1).default(['email', 'google', 'apple', 'facebook']),
  }),
]);

export interface ApplicationInsightsSettings {
  instrumentationKey: string;
  /** HTTPS origin (and optional path) that receives telemetry, e.g. `https://eastus-8.in.applicationinsights.azure.com/`. */
  ingestionEndpoint: string;
}

/** Keys that belong to secret-bearing connection strings (Storage, Service Bus, SQL…), never to a browser config. */
const SECRET_CONNECTION_STRING_KEY =
  /(^|;)\s*(AccountKey|SharedAccessKey|SharedAccessSignature|Password|Pwd)\s*=/i;
const INSTRUMENTATION_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses an Azure Monitor Application Insights connection string
 * (`InstrumentationKey=…;IngestionEndpoint=https://…;LiveEndpoint=…;ApplicationId=…`). It identifies where telemetry is
 * sent and is designed to be shipped to browsers; it is not a credential.
 */
export function parseApplicationInsightsConnectionString(
  value: string,
): { ok: true; settings: ApplicationInsightsSettings } | { ok: false; problem: string } {
  if (SECRET_CONNECTION_STRING_KEY.test(value)) {
    return {
      ok: false,
      problem:
        'contains a secret (account key, SAS or password); this is not an Application Insights connection string',
    };
  }
  const parts = new Map<string, string>();
  for (const pair of value.split(';')) {
    const index = pair.indexOf('=');
    if (index > 0) parts.set(pair.slice(0, index).trim().toLowerCase(), pair.slice(index + 1).trim());
  }
  const instrumentationKey = parts.get('instrumentationkey') ?? '';
  if (!INSTRUMENTATION_KEY.test(instrumentationKey)) {
    return {
      ok: false,
      problem: 'must contain InstrumentationKey=<guid> (copy it from Application Insights → Overview)',
    };
  }
  const suffix = parts.get('endpointsuffix');
  const ingestionEndpoint =
    parts.get('ingestionendpoint') ??
    (suffix ? `https://dc.${suffix}/` : 'https://dc.services.visualstudio.com/');
  try {
    if (new URL(ingestionEndpoint).protocol !== 'https:')
      return { ok: false, problem: 'IngestionEndpoint must use HTTPS' };
  } catch {
    return { ok: false, problem: 'IngestionEndpoint is not a valid URL' };
  }
  return { ok: true, settings: { instrumentationKey, ingestionEndpoint } };
}

const telemetrySchema = z.object({
  enabled: z.boolean().default(false),
  /** Optional public ingestion endpoint (must also be allowed in CSP connect-src). */
  endpoint: z.url().optional(),
  /**
   * Azure Monitor Application Insights connection string. Public by design (browsers need it to send telemetry); its
   * ingestion endpoint is added to CSP connect-src at deploy time.
   */
  connectionString: z
    .string()
    .max(1000)
    .superRefine((value, ctx) => {
      const result = parseApplicationInsightsConnectionString(value);
      if (!result.ok) ctx.addIssue({ code: 'custom', message: result.problem });
    })
    .optional(),
  /** Fraction of sessions sampled, 0–1. */
  sampleRate: z.number().min(0).max(1).default(1),
  /** Also log every telemetry item to the browser console (local diagnostics; not allowed in secure environments). */
  console: z.boolean().default(false),
});

export const appConfigSchema = z
  .object({
    environment: z.enum(environments),
    /** Backend base URL including the API version prefix, e.g. `https://api.example.com/api/v1`. */
    apiBaseUrl: z.url(),
    endpoints: endpointsSchema,
    apiTimeoutMs: z.number().int().min(1000).max(120_000).default(15_000),
    cache: z.object({
      enabled: z.boolean().default(true),
      persist: z.boolean().default(false),
      prefetchTomorrow: z.boolean().default(false),
      schemaVersion: z.string().min(1).max(80).default('1'),
      rulesVersion: z.string().min(1).max(80).default('1'),
    }).strict().default({ enabled: true, persist: false, prefetchTomorrow: false, schemaVersion: '1', rulesVersion: '1' }),
    defaultTradition: z.string().default('all'),
    auth: authSchema.default({ mode: 'disabled' }),
    featureFlags: featureFlagsSchema.default(
      Object.fromEntries(featureFlagNames.map((f) => [f, false])) as Record<FeatureFlag, boolean>,
    ),
    telemetry: telemetrySchema.default({ enabled: false, sampleRate: 1, console: false }),
  })
  .strict()
  .superRefine((config, ctx) => {
    // Zod runs this check even when a field already failed; unparsable URLs are reported by their own field.
    const url = tryParseUrl(config.apiBaseUrl);
    if (!url) return;
    const isLocalHost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '10.0.2.2';
    // Plain HTTP only for an API on the developer's own machine (or the Android emulator's host alias).
    const developerEnvironment = !SECURE_ENVIRONMENTS.includes(config.environment);
    if (url.protocol !== 'https:' && !(isLocalHost && developerEnvironment)) {
      ctx.addIssue({
        code: 'custom',
        path: ['apiBaseUrl'],
        message:
          'apiBaseUrl must use HTTPS unless it points to localhost in a local, development or test environment.',
      });
    }
    if (config.auth.mode === 'entra-external-id') {
      for (const field of ['redirectUri', 'postLogoutRedirectUri'] as const) {
        const target = tryParseUrl(config.auth[field]);
        if (!target) continue;
        const local = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
        const web = target.protocol === 'http:' || target.protocol === 'https:';
        if (web && target.protocol !== 'https:' && !(local && developerEnvironment)) {
          ctx.addIssue({
            code: 'custom',
            path: ['auth', field],
            message:
              'must use HTTPS unless it points to localhost in a local, development or test environment.',
          });
        }
      }
    }
    if (config.telemetry.console && !developerEnvironment) {
      ctx.addIssue({
        code: 'custom',
        path: ['telemetry', 'console'],
        message: 'Console telemetry is only allowed in local, development and test environments.',
      });
    }
    if (config.auth.mode === 'mock' && config.environment !== 'local' && config.environment !== 'test') {
      ctx.addIssue({
        code: 'custom',
        path: ['auth', 'mode'],
        message: 'Mock authentication is only allowed in local and test environments.',
      });
    }
    if (url.search || url.hash || url.username || url.password) {
      ctx.addIssue({
        code: 'custom',
        path: ['apiBaseUrl'],
        message: 'apiBaseUrl must not contain credentials, a query or a fragment.',
      });
    }
  });

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export type AppConfig = z.infer<typeof appConfigSchema>;
export type AuthConfig = AppConfig['auth'];

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; issues: string[] };

/** Validates untrusted configuration input. Issues name fields only — never echo values (they may be misplaced secrets). */
export function parseAppConfig(input: unknown): ConfigResult {
  const result = appConfigSchema.safeParse(input);
  if (result.success) return { ok: true, config: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}

type EntraConfig = Extract<AuthConfig, { mode: 'entra-external-id' }>;

/**
 * The OpenID Connect issuer for standards-based clients (discovery at `<issuer>/.well-known/openid-configuration`):
 * `https://<subdomain>.ciamlogin.com/<tenant>/v2.0`, derived from the ciamlogin authority and tenant ID.
 */
export function entraIssuer(auth: Pick<EntraConfig, 'authority' | 'tenantId'>): string {
  const url = new URL(auth.authority);
  const path = url.pathname.replace(/\/+$/, '');
  if (path) return `${url.origin}${path}${path.endsWith('/v2.0') ? '' : '/v2.0'}`;
  const tenant = auth.tenantId ?? `${url.hostname.split('.')[0]}.onmicrosoft.com`;
  return `${url.origin}/${tenant}/v2.0`;
}

export function isFeatureEnabled(config: Pick<AppConfig, 'featureFlags'>, flag: FeatureFlag): boolean {
  return config.featureFlags[flag];
}

/** Application Insights settings when telemetry is enabled and a connection string is configured, else undefined. */
export function applicationInsightsSettings(
  config: Pick<AppConfig, 'telemetry'>,
): ApplicationInsightsSettings | undefined {
  const { enabled, connectionString } = config.telemetry;
  if (!enabled || !connectionString) return undefined;
  const result = parseApplicationInsightsConnectionString(connectionString);
  return result.ok ? result.settings : undefined;
}

/**
 * Every origin the SPA calls for a configuration: the API, the identity authority (when sign-in is configured) and the
 * telemetry ingestion endpoint (when telemetry is enabled). Drives CSP `connect-src` and the deployment smoke test.
 */
export function externalOrigins(config: AppConfig): string[] {
  const origins = [new URL(config.apiBaseUrl).origin];
  if (config.auth.mode === 'oidc' || config.auth.mode === 'entra-external-id') {
    origins.push(new URL(config.auth.authority).origin);
  }
  if (config.telemetry.enabled && config.telemetry.endpoint)
    origins.push(new URL(config.telemetry.endpoint).origin);
  const insights = applicationInsightsSettings(config);
  if (insights) origins.push(new URL(insights.ingestionEndpoint).origin);
  return [...new Set(origins)];
}
