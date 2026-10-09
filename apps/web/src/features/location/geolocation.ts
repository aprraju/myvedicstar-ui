import { GeolocationError, type GeolocationProvider } from '@myvedicstar/domain-models';

export {
  GeolocationError,
  type GeolocationErrorKind,
  type GeolocationProvider,
  type PermissionStatus,
} from '@myvedicstar/domain-models';

/** Browser implementation of the shared GeolocationProvider interface. */

export const browserGeolocation: GeolocationProvider = {
  async permission() {
    if (!('geolocation' in navigator)) return 'unsupported';
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      return status?.state ?? 'prompt';
    } catch {
      return 'prompt'; // Permissions API unavailable (e.g. older Safari): asking is the only way to know.
    }
  },
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new GeolocationError('unsupported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (error) =>
          reject(
            new GeolocationError(
              error.code === error.PERMISSION_DENIED
                ? 'permissionDenied'
                : error.code === error.TIMEOUT
                  ? 'timeout'
                  : 'unavailable',
            ),
          ),
        // City-level accuracy is enough for Panchang timings and friendlier to battery and privacy.
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
      );
    });
  },
};
