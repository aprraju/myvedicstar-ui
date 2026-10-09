import {
  type AnalyticsClient,
  consoleSink,
  createObservability,
  type TelemetryClient,
  type TelemetrySink,
} from '@myvedicstar/analytics';
import { type ApiClient, createApiClient, retryDelayMs, shouldRetryQuery } from '@myvedicstar/api-client';
import type { AppConfig } from '@myvedicstar/config';
import { QueryClient } from '@tanstack/react-query';
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

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: retryDelayMs,
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
      },
      mutations: { retry: false },
    },
  });

  return { config, api, auth, analytics, telemetry, queryClient };
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
