import { createMemorySink } from '@myvedicstar/analytics';
import { parseAppConfig } from '@myvedicstar/config';
import {
  GeolocationError,
  type GeolocationErrorKind,
  type GeolocationProvider,
  type PermissionStatus,
  type SelectedLocation,
  toSelectedLocation,
} from '@myvedicstar/domain-models';
import { fixtures } from '@myvedicstar/testing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, configure } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { AppProviders } from '../app/AppProviders';
import { type AuthClient, createDisabledAuthClient } from '../shared/auth';
import { createMobileServices } from '../shared/services';

export const austin = toSelectedLocation(fixtures.location.austin, 'search');
export const hyderabad = toSelectedLocation(fixtures.location.hyderabadCoordinates, 'current');
// Native routing and debounced searches can exceed the library's one-second default on CI.
configure({ asyncUtilTimeout: 5000 });
beforeEach(() => atInstant('2026-09-29T10:00:00-05:00'));

/** Same choice as the web MSW handlers: Other → Business; Business → one Good Time; General today → that date. */
function goodTimesFor(url: URL, hyderabadRequested: boolean) {
  const { goodTimes } = fixtures.muhurta;
  const activity = url.searchParams.get('activity') ?? 'general';
  if (activity === 'other') return goodTimes.austinOther;
  if (activity === 'business')
    return hyderabadRequested ? goodTimes.hyderabadExcluded : goodTimes.austinBusiness;
  if (!url.searchParams.get('date'))
    return hyderabadRequested ? goodTimes.hyderabadToday : goodTimes.austinToday;
  return goodTimes.austinGeneral;
}

/** Every API request the fake backend received. */
export const apiRequests: URL[] = [];

type Responder = (url: URL) => { status: number; body: unknown } | undefined;

/** Fake backend serving fixtures captured from the real API; `override` handles specific scenarios first. */
export function fakeFetch(override?: Responder): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    apiRequests.push(url);
    const hyderabadRequested =
      url.searchParams.get('latitude')?.startsWith('17.') ||
      /hyderabad/i.test(url.searchParams.get('place') ?? '');
    const response =
      override?.(url) ??
      (url.pathname.endsWith('/settings')
        ? {
            status: 200,
            body: { defaultTradition: null, defaultLocationId: null, defaultLocation: null, revision: 0 },
          }
        : url.pathname.endsWith('/settings/locations')
          ? { status: 200, body: [] }
          : url.pathname.endsWith('/auth/userinfo')
            ? { status: 200, body: fixtures.userInfo }
            : url.pathname.endsWith('/muhurta/activities')
              ? { status: 200, body: fixtures.muhurta.activities }
              : url.pathname.endsWith('/muhurta/good-times/best')
                ? {
                    status: 200,
                    body:
                      url.searchParams.get('activity') === 'other'
                        ? fixtures.muhurta.best.austinOther
                        : fixtures.muhurta.best.austinBusiness,
                  }
                : url.pathname.endsWith('/muhurta/day-summaries')
                  ? {
                      status: 200,
                      body:
                        url.searchParams.get('activity') === 'general'
                          ? fixtures.muhurta.daySummaries
                          : fixtures.muhurta.daySummariesBusiness,
                    }
                  : url.pathname.endsWith('/muhurta/good-times')
                    ? { status: 200, body: goodTimesFor(url, Boolean(hyderabadRequested)) }
                    : url.pathname.endsWith('/traditions')
                      ? { status: 200, body: fixtures.traditions }
                      : url.pathname.endsWith('/locations/resolve')
                        ? {
                            status: 200,
                            body: hyderabadRequested
                              ? fixtures.location.hyderabadCoordinates
                              : fixtures.location.austin,
                          }
                        : {
                            status: 200,
                            body: hyderabadRequested
                              ? fixtures.panchang.hyderabadAll
                              : fixtures.panchang.austinTelugu,
                          });
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': response.status >= 400 ? 'application/problem+json' : 'application/json' },
    });
  }) as typeof fetch;
}

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

export async function storeLocation(location: SelectedLocation = austin) {
  await AsyncStorage.setItem('mvs.location.selected', JSON.stringify(location));
}

/** Freezes `Date.now()` (timers keep running) at an instant, e.g. '2026-09-29T10:00:00-05:00'. */
export function atInstant(iso: string) {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(iso));
}

export interface AppRenderOptions {
  auth?: AuthClient;
  geolocation?: GeolocationProvider;
  fetchOverride?: Responder;
  initialUrl?: string;
  configOverrides?: Record<string, unknown>;
}

/** Renders app routes inside the real AppProviders with a fake backend. */
export async function renderApp(
  routes: Record<string, ComponentType>,
  { auth, geolocation, fetchOverride, initialUrl = '/', configOverrides = {} }: AppRenderOptions = {},
) {
  const result = parseAppConfig({
    environment: 'test',
    apiBaseUrl: 'https://api.test.example/api/v1',
    ...configOverrides,
  });
  if (!result.ok) throw new Error(result.issues.join());
  const services = createMobileServices(result.config, {
    sinks: [createMemorySink()],
    fetchImpl: fakeFetch(fetchOverride),
    auth: auth ?? createDisabledAuthClient(),
  });
  services.queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });

  const Root = ({ children }: { children: React.ReactNode }) => (
    <AppProviders services={services} language="en" geolocation={geolocation ?? fakeGeolocation()}>
      {children}
    </AppProviders>
  );
  const rendered = await renderRouter(routes, { initialUrl, wrapper: Root });
  return { ...rendered, services };
}

afterEach(async () => {
  // renderRouter installs fake timers; unmount and drop pending timers so nothing leaks into the next test.
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  apiRequests.length = 0;
  jest.restoreAllMocks();
  await AsyncStorage.clear();
});
