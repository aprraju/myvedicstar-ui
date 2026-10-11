import {
  type AnalyticsClient,
  consoleSink,
  createObservability,
  type TelemetryClient,
  type TelemetrySink,
} from '@myvedicstar/analytics';
import { type ApiClient, createApiClient } from '@myvedicstar/api-client';
import type { AppConfig } from '@myvedicstar/config';
import {
  type CacheReporter,
  createCachePersister,
  createCachingClient,
  createLocationSearchService,
  type LocationSearchService,
} from '@myvedicstar/query-cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { createContext, type ReactNode, useContext } from 'react';
import { Platform } from 'react-native';

import { type AuthClient, createAuthClient } from './auth/auth-client';

/** Mobile counterpart of the web AppServices: same shared packages, platform-specific wiring. */
export interface MobileServices {
  config: AppConfig;
  api: ApiClient;
  auth: AuthClient;
  analytics: AnalyticsClient;
  telemetry: TelemetryClient;
  queryClient: QueryClient;
  cachePersister?: Persister | undefined;
  locationSearch: LocationSearchService;
}

export function createMobileServices(
  config: AppConfig,
  overrides: { sinks?: readonly TelemetrySink[]; fetchImpl?: typeof fetch; auth?: AuthClient } = {},
): MobileServices {
  const sinks = overrides.sinks ?? (config.environment === 'local' ? [consoleSink] : []);
  const { analytics, telemetry } = createObservability({ sinks, hasAnalyticsConsent: () => false });
  telemetry.setContext({
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    environment: config.environment,
    platform: Platform.OS,
  });

  const auth = overrides.auth ?? createAuthClient(config.auth);

  const api = createApiClient({
    baseUrl: config.apiBaseUrl,
    endpoints: config.endpoints,
    timeoutMs: config.apiTimeoutMs,
    ...(config.locationSearch.enabled ? { coordinateDecimals: false as const } : {}),
    getAccessToken: () => auth.getAccessToken(),
    onUnauthorized: () => auth.handleUnauthorized(),
    ...(overrides.fetchImpl ? { fetchImpl: overrides.fetchImpl } : {}),
    onRequestComplete: (m) =>
      telemetry.trackMetric('api.duration', m.durationMs, {
        operation: m.operation,
        status: m.status,
        outcome: m.outcome,
        errorKind: m.errorKind,
        correlationId: m.correlationId,
      }),
  });

  const report: CacheReporter =
    config.environment === 'local' || config.environment === 'test'
      ? (event) => telemetry.trackMetric(`cache.${event.event}`, event.value ?? 1, { family: event.family })
      : () => undefined;
  const queryClient = createCachingClient(config.cache, report);
  const cachePersister =
    config.cache.enabled && config.cache.persist
      ? createCachePersister(AsyncStorage, config.cache, report)
      : undefined;

  const locationSearch = createLocationSearchService(api, queryClient, config.locationSearch);
  return { config, api, auth, analytics, telemetry, queryClient, cachePersister, locationSearch };
}

const ServicesContext = createContext<MobileServices | null>(null);

export function ServicesProvider({ services, children }: { services: MobileServices; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): MobileServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
