import { type LocationResolver, type SelectedLocation, toSelectedLocation } from './location';

/**
 * Device-position abstraction shared by web (browser Geolocation API) and mobile (expo-location). UI code never
 * touches a platform location API directly, so providers can be swapped for tests or other platforms.
 */
export type GeolocationErrorKind = 'permissionDenied' | 'unavailable' | 'timeout' | 'unsupported';
export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export class GeolocationError extends Error {
  constructor(readonly kind: GeolocationErrorKind) {
    super(`Geolocation failed: ${kind}`);
    this.name = 'GeolocationError';
  }
}

export interface GeolocationProvider {
  /** Current permission without prompting. */
  permission(): Promise<PermissionStatus>;
  /** Prompts if needed; rejects with GeolocationError. City-level accuracy is enough. */
  getCurrentPosition(): Promise<{ latitude: number; longitude: number }>;
}

/** Gets the device position and names it through the backend (city label + time zone). */
export async function locateAndResolve(
  geolocation: GeolocationProvider,
  resolve: LocationResolver,
): Promise<SelectedLocation> {
  const position = await geolocation.getCurrentPosition();
  return toSelectedLocation(await resolve(position), 'current');
}

/** Whether the app may request the position automatically at start-up (never after a denial). */
export function mayAutoDetect(permission: PermissionStatus, previouslyDenied: boolean): boolean {
  return !previouslyDenied && (permission === 'granted' || permission === 'prompt');
}
