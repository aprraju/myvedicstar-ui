import { createMemorySink } from '@myvedicstar/analytics';
import { type AppConfig, parseAppConfig } from '@myvedicstar/config';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';

import { AppProviders } from '../app/App';
import { appRoutes } from '../app/router/router';
import {
  GeolocationError,
  type GeolocationErrorKind,
  type GeolocationProvider,
  type PermissionStatus,
} from '../features/location';
import { type AuthClient, createDisabledAuthClient } from '../shared/auth';
import { createServices } from '../shared/services/services';
import { TEST_API_BASE_URL } from './msw/handlers';

export function createTestConfig(overrides: Partial<Record<string, unknown>> = {}): AppConfig {
  const result = parseAppConfig({
    environment: 'test',
    apiBaseUrl: `${TEST_API_BASE_URL}/api/v1`,
    ...overrides,
  });
  if (!result.ok) throw new Error(result.issues.join('\n'));
  return result.config;
}

export function createTestServices(options: { auth?: AuthClient; config?: AppConfig } = {}) {
  const sink = createMemorySink();
  const services = createServices(options.config ?? createTestConfig(), {
    auth: options.auth ?? createDisabledAuthClient(),
    sinks: [sink],
  });
  // Tests should fail fast rather than wait for retries.
  services.queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
  return { services, telemetry: sink };
}

/** Controllable device position for tests. Defaults to a browser without geolocation. */
export function fakeGeolocation(
  options: {
    permission?: PermissionStatus;
    position?: { latitude: number; longitude: number };
    error?: GeolocationErrorKind;
  } = {},
): GeolocationProvider & { requests: number } {
  const provider = {
    requests: 0,
    permission: async () => options.permission ?? 'unsupported',
    getCurrentPosition: async () => {
      provider.requests += 1;
      if (options.error) throw new GeolocationError(options.error);
      if (!options.position) throw new GeolocationError('unsupported');
      return options.position;
    },
  };
  return provider;
}

interface RenderOptions {
  auth?: AuthClient;
  config?: AppConfig;
  geolocation?: GeolocationProvider;
  /** Initial URL for the memory router, so a component that reads the query string can be exercised. */
  route?: string;
}

/** Renders a single component with all app providers (inside a memory router, for links). */
export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const { services, telemetry } = createTestServices(options);
  return {
    ...render(
      <AppProviders services={services} language="en" geolocation={options.geolocation ?? fakeGeolocation()}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
      </AppProviders>,
    ),
    services,
    telemetry,
  };
}

/** Renders the real route table at a URL, with all app providers. */
export function renderRoute(url: string, options: RenderOptions = {}) {
  const { services, telemetry } = createTestServices(options);
  const router = createMemoryRouter(appRoutes, { initialEntries: [url] });
  const result = render(
    <AppProviders services={services} language="en" geolocation={options.geolocation ?? fakeGeolocation()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, services, telemetry };
}
