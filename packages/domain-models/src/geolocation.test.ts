import { fixtures } from '@myvedicstar/testing';
import { describe, expect, it, vi } from 'vitest';

import { GeolocationError, type GeolocationProvider, locateAndResolve, mayAutoDetect } from './index';

describe('locateAndResolve', () => {
  it('names the device position through the resolver', async () => {
    const geolocation: GeolocationProvider = {
      permission: async () => 'granted',
      getCurrentPosition: async () => ({ latitude: 30.2672, longitude: -97.7431 }),
    };
    const resolve = vi.fn().mockResolvedValue(fixtures.location.austin);
    const location = await locateAndResolve(geolocation, resolve);
    expect(resolve).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(location).toMatchObject({
      label: 'Austin, Texas',
      source: 'current',
      timeZone: 'America/Chicago',
    });
  });

  it('propagates typed geolocation errors', async () => {
    const geolocation: GeolocationProvider = {
      permission: async () => 'denied',
      getCurrentPosition: async () => {
        throw new GeolocationError('permissionDenied');
      },
    };
    await expect(locateAndResolve(geolocation, vi.fn())).rejects.toMatchObject({ kind: 'permissionDenied' });
  });
});

describe('mayAutoDetect', () => {
  it('asks only when allowed and never after a denial', () => {
    expect(mayAutoDetect('granted', false)).toBe(true);
    expect(mayAutoDetect('prompt', false)).toBe(true);
    expect(mayAutoDetect('prompt', true)).toBe(false);
    expect(mayAutoDetect('denied', false)).toBe(false);
    expect(mayAutoDetect('unsupported', false)).toBe(false);
  });
});
