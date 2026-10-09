import { toSelectedLocation } from '@myvedicstar/domain-models';
import { fixtures } from '@myvedicstar/testing';

export const austin = toSelectedLocation(fixtures.location.austin, 'search');
export const hyderabad = toSelectedLocation(fixtures.location.hyderabadCoordinates, 'current');

/** Starts a test with a location already chosen (as a returning visitor would). */
export function storeSelectedLocation(location = austin) {
  window.localStorage.setItem('mvs.location.selected', JSON.stringify(location));
}

/** Freezes only `Date` (timers and promises keep working) at an instant, e.g. '2026-09-29T10:00:00-05:00'. */
export async function atInstant(iso: string) {
  const { vi } = await import('vitest');
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) });
}
