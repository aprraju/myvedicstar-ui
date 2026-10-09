import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserGeolocation, GeolocationError } from './geolocation';

const ERROR_CODES = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as const;

function stubGeolocation(getCurrentPosition: Geolocation['getCurrentPosition']) {
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: { getCurrentPosition },
    permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('browserGeolocation.permission', () => {
  it('reports the Permissions API state', async () => {
    stubGeolocation(vi.fn());
    expect(await browserGeolocation.permission()).toBe('granted');
  });

  it('falls back to "prompt" when the Permissions API is unavailable or throws', async () => {
    vi.stubGlobal('navigator', { geolocation: {} });
    expect(await browserGeolocation.permission()).toBe('prompt');
    vi.stubGlobal('navigator', {
      geolocation: {},
      permissions: { query: vi.fn().mockRejectedValue(new Error()) },
    });
    expect(await browserGeolocation.permission()).toBe('prompt');
  });

  it('reports "unsupported" without the Geolocation API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await browserGeolocation.permission()).toBe('unsupported');
  });
});

describe('browserGeolocation.getCurrentPosition', () => {
  it('resolves city-level coordinates without high accuracy', async () => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success) =>
      success({ coords: { latitude: 30.2672, longitude: -97.7431 } } as GeolocationPosition),
    );
    stubGeolocation(getCurrentPosition);

    await expect(browserGeolocation.getCurrentPosition()).resolves.toEqual({
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({ enableHighAccuracy: false });
  });

  it.each([
    [ERROR_CODES.PERMISSION_DENIED, 'permissionDenied'],
    [ERROR_CODES.TIMEOUT, 'timeout'],
    [ERROR_CODES.POSITION_UNAVAILABLE, 'unavailable'],
  ])('maps browser error code %i to "%s"', async (code, kind) => {
    stubGeolocation((_, failure) =>
      failure?.({ code, message: '', ...ERROR_CODES } as GeolocationPositionError),
    );
    const error = await browserGeolocation.getCurrentPosition().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeolocationError);
    expect(error).toMatchObject({ kind });
  });

  it('rejects as "unsupported" without the Geolocation API', async () => {
    vi.stubGlobal('navigator', {});
    await expect(browserGeolocation.getCurrentPosition()).rejects.toMatchObject({ kind: 'unsupported' });
  });
});
