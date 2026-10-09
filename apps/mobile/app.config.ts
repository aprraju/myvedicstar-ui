import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Native app configuration, evaluated at build time (EAS build profiles set the environment variables).
 * Runtime app settings (API URL, feature flags) are the `EXPO_PUBLIC_*` variables read in src/app/config.ts.
 * No secrets here: everything in an app binary is public. Signing credentials live in EAS / the CI secret store.
 */
const environment = process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'local';
const isProduction = environment === 'production';
const suffix = isProduction ? '' : `.${environment}`;
const LOCATION_PURPOSE =
  'My Vedic Star uses your location to calculate sunrise, sunset and Panchang timings for where you are.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProduction ? 'My Vedic Star' : `My Vedic Star (${environment})`,
  slug: 'myvedicstar',
  scheme: 'myvedicstar',
  version: '0.1.0',
  orientation: 'default', // portrait and landscape: tablets, foldables and split-screen
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: `com.myvedicstar.app${suffix}`,
    supportsTablet: true,
    requireFullScreen: false, // allow iPad Split View / Slide Over
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_PURPOSE,
    },
  },
  android: {
    package: `com.myvedicstar.app${suffix}`,
    // Activities are resizable by default (multi-window, freeform, foldables); never opt out.
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA'],
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_PURPOSE,
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
