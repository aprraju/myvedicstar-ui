import {
  type AnalyticsClient,
  consoleSink,
  createApplicationInsightsSink,
  createObservability,
  type TelemetryClient,
  type TelemetrySink,
} from '@myvedicstar/analytics';
import { type ApiClient, createApiClient, KEY_COORDINATE_DECIMALS } from '@myvedicstar/api-client';
import { type AppConfig, applicationInsightsSettings } from '@myvedicstar/config';
import { getWindowClass } from '@myvedicstar/design-tokens';
import {
  type CacheReporter,
  createCachePersister,
  createLocationSearchService,
  type LocationSearchService,
  seedUserInfo,
} from '@myvedicstar/query-cache';
import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import { withAuthAudit } from '../auth/audited-auth-client';
import { type AuthClient, createAuthClient } from '../auth/auth-client';
import { createIndexedDbCacheStorage } from './cache-storage';
import { createQueryClient } from './query-client';

/**
 * Everything the UI needs from the outside world, created once at startup and provided through context.
 * Tests create the same structure with fakes (see src/test/render.tsx).
 */
export interface AppServices {
  config: AppConfig;
  api: ApiClient;
  auth: AuthClient;
  analytics: AnalyticsClient;
  telemetry: TelemetryClient;
  queryClient: QueryClient;
  cachePersister?: Persister | undefined;
  locationSearch: LocationSearchService;
}

interface ServiceOverrides {
  auth?: AuthClient;
  sinks?: readonly TelemetrySink[];
  fetchImpl?: typeof fetch;
}

/**
 * Telemetry destinations from runtime configuration: the browser console when `telemetry.console` is set (local
 * diagnostics), Application Insights when telemetry is enabled with a connection string, otherwise none.
 */
function telemetrySinks(config: AppConfig): TelemetrySink[] {
  const sinks: TelemetrySink[] = config.telemetry.console ? [consoleSink] : [];
  const insights = applicationInsightsSettings(config);
  if (insights) {
    const sink = createApplicationInsightsSink({
      ...insights,
      roleName: 'myvedicstar-web',
      sampleRate: config.telemetry.sampleRate,
    });
    // Send what is buffered before the tab is hidden or closed (keepalive requests outlive the page).
    window.addEventListener('pagehide', () => sink.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sink.flush();
    });
    sinks.push(sink);
  }
  return sinks;
}

export function createServices(config: AppConfig, overrides: ServiceOverrides = {}): AppServices {
  const sinks = overrides.sinks ?? telemetrySinks(config);
  // Analytics consent UI arrives with Settings (Phase 5); until then no analytics events are sent.
  const { analytics, telemetry } = createObservability({ sinks, hasAnalyticsConsent: () => false });

  telemetry.setContext({
    appVersion: __APP_VERSION__,
    buildId: __BUILD_ID__,
    environment: config.environment,
    platform: 'web',
    deviceClass: getWindowClass(window.innerWidth),
  });

  const auth = overrides.auth ?? createAuthClient(config.auth);

  const api = createApiClient({
    baseUrl: config.apiBaseUrl,
    endpoints: config.endpoints,
    timeoutMs: config.apiTimeoutMs,
    // Location search keeps ~11 m precision (stable URLs and cache keys); the backend rounds further for calculations.
    ...(config.locationSearch.enabled ? { coordinateDecimals: KEY_COORDINATE_DECIMALS } : {}),
    getAccessToken: () => auth.getAccessToken(),
    onUnauthorized: () => auth.handleUnauthorized(),
    ...(overrides.fetchImpl ? { fetchImpl: overrides.fetchImpl } : {}),
    onRequestComplete: (metrics) =>
      telemetry.trackMetric('api.duration', metrics.durationMs, {
        operation: metrics.operation,
        status: metrics.status,
        outcome: metrics.outcome,
        errorKind: metrics.errorKind,
        correlationId: metrics.correlationId,
      }),
  });

  const report: CacheReporter =
    config.environment === 'local' || config.environment === 'test'
      ? (event) => telemetry.trackMetric(`cache.${event.event}`, event.value ?? 1, { family: event.family })
      : () => undefined;
  const queryClient = createQueryClient(config.cache, report);
  const cachePersister =
    config.cache.enabled && config.cache.persist
      ? createCachePersister(createIndexedDbCacheStorage(), config.cache, report)
      : undefined;
  const locationSearch = createLocationSearchService(api, queryClient, config.locationSearch);
  const auditedAuth = withAuthAudit(
    auth,
    api,
    (operation) => telemetry.trackMetric('auth.auditFailed', 1, { operation }),
    (userId, userInfo) => seedUserInfo(queryClient, userId, userInfo),
  );
  return {
    config,
    api,
    auth: auditedAuth,
    analytics,
    telemetry,
    queryClient,
    cachePersister,
    locationSearch,
  };
}
