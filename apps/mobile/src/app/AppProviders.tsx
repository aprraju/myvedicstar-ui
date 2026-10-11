import type { GeolocationProvider } from '@myvedicstar/domain-models';
import { CacheProvider } from '@myvedicstar/query-cache';
import type { ReactNode } from 'react';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { LocationProvider } from '../features/location/LocationProvider';
import { LocationSheet } from '../features/location/LocationSheet';
import { TraditionProvider } from '../features/tradition/TraditionProvider';
import { I18nProvider } from '../shared/i18n';
import { CacheLifecycle } from '../shared/CacheLifecycle';
import { type MobileServices, ServicesProvider } from '../shared/services';

/**
 * Application-wide state, outermost first: services (API, auth, telemetry), server-state cache, language, then the
 * app state shared by unrelated screens — tradition and selected location. Used by the root layout and by tests.
 */
export function AppProviders({
  services,
  geolocation,
  language,
  children,
}: {
  services: MobileServices;
  geolocation?: GeolocationProvider;
  language?: string;
  children: ReactNode;
}) {
  return (
    // Initial metrics avoid a blank first frame while insets are measured.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ServicesProvider services={services}>
        <CacheProvider client={services.queryClient} settings={services.config.cache} persister={services.cachePersister}>
          <CacheLifecycle />
          <I18nProvider {...(language ? { language } : {})}>
            <TraditionProvider>
              <LocationProvider {...(geolocation ? { geolocation } : {})}>
                {children}
                <LocationSheet />
              </LocationProvider>
            </TraditionProvider>
          </I18nProvider>
        </CacheProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
