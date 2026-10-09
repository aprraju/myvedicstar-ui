import { GeolocationError, type GeolocationProvider } from '@myvedicstar/domain-models';
import * as Location from 'expo-location';

/** expo-location implementation of the shared GeolocationProvider interface (foreground, city-level accuracy). */
export const expoGeolocation: GeolocationProvider = {
  async permission() {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) return 'granted';
      if (status === Location.PermissionStatus.DENIED && !canAskAgain) return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  },
  async getCurrentPosition() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) throw new GeolocationError('permissionDenied');
    if (!(await Location.hasServicesEnabledAsync())) throw new GeolocationError('unavailable');
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch {
      throw new GeolocationError('unavailable');
    }
  },
};
