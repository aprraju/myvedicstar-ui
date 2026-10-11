import { CacheProvider } from '@myvedicstar/query-cache';
import { type ReactNode, useState } from 'react';
import { RouterProvider } from 'react-router';

import { type GeolocationProvider, LocationDialog, LocationStateProvider } from '../features/location';
import { TraditionStateProvider } from '../features/tradition';
import { useRefetchOnUserChange, useUserInfo } from '../shared/auth';
import { AppErrorBoundary } from '../shared/errors/AppErrorBoundary';
import { I18nProvider } from '../shared/i18n/I18nProvider';
import type { AppServices } from '../shared/services/services';
import { ServicesProvider } from '../shared/services/ServicesContext';
import { ThemeProvider } from '../shared/theme/ThemeProvider';
import { ConfigErrorScreen } from './config/ConfigErrorScreen';
import { createAppRouter } from './router/router';

export function App({ services }: { services: AppServices }) {
  const [router] = useState(() => createAppRouter());
  return (
    <AppErrorBoundary telemetry={services.telemetry} fallback={<ConfigErrorScreen />}>
      <AppProviders services={services}>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  );
}

/**
 * Application-wide state, outermost first: services, server-state cache, language, theme, then the two pieces of
 * app state shared by unrelated routes — selected location and tradition. Used by the app and by tests.
 */
export function AppProviders({
  services,
  language,
  geolocation,
  children,
}: {
  services: AppServices;
  language?: string;
  geolocation?: GeolocationProvider;
  children: ReactNode;
}) {
  return (
    <ServicesProvider services={services}>
      <CacheProvider client={services.queryClient} settings={services.config.cache} persister={services.cachePersister}>
        <RefetchOnUserChange />
        <I18nProvider {...(language ? { language } : {})}>
          <ThemeProvider>
            <TraditionStateProvider>
              <LocationStateProvider {...(geolocation ? { geolocation } : {})}>
                {children}
                <LocationDialog />
              </LocationStateProvider>
            </TraditionStateProvider>
          </ThemeProvider>
        </I18nProvider>
      </CacheProvider>
    </ServicesProvider>
  );
}

/** Re-requests API data with the access token whenever the signed-in user changes. */
function RefetchOnUserChange() {
  useRefetchOnUserChange();
  // Keep the login POST subscribed for the lifetime of the app, including route transitions.
  useUserInfo();
  return null;
}
