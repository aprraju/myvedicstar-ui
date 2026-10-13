import { fixtures } from '@myvedicstar/testing';
import { describe, expect, it, vi } from 'vitest';

import { addRecentLocation, type LocationResolver, searchLocation, toSelectedLocation } from './index';

describe('toSelectedLocation', () => {
  it('labels a matched city and keeps its zone', () => {
    expect(toSelectedLocation(fixtures.location.austin, 'search')).toEqual({
      id: '30.27,-97.74',
      label: 'Austin, Texas',
      fullName: 'Austin, Texas, United States',
      latitude: 30.27,
      longitude: -97.74,
      timeZone: 'America/Chicago',
      countryCode: 'US',
      city: 'Austin',
      region: 'Texas',
      country: 'United States',
      source: 'search',
    });
  });

  it('labels coordinates when no city is nearby and never keeps more than 2 decimals', () => {
    const location = toSelectedLocation(
      {
        latitude: -12.345678,
        longitude: 101.987654,
        timeZone: 'Etc/GMT-7',
        source: 'Coordinates',
        place: null,
      },
      'coordinates',
    );
    expect(location.label).toBe('-12.35, 101.99');
    expect(location.latitude).toBe(-12.35);
  });
});

describe('addRecentLocation', () => {
  const austin = toSelectedLocation(fixtures.location.austin, 'search');
  const hyderabad = toSelectedLocation(fixtures.location.hyderabadCoordinates, 'current');

  it('puts the latest first without duplicates', () => {
    expect(addRecentLocation([austin, hyderabad], hyderabad).map((l) => l.label)).toEqual([
      hyderabad.label,
      austin.label,
    ]);
  });

  it('keeps at most five', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...austin, id: String(i) }));
    expect(addRecentLocation(many.slice(1), many[0]!)).toHaveLength(5);
  });
});

describe('searchLocation', () => {
  const resolver = () => vi.fn<LocationResolver>().mockResolvedValue(fixtures.location.austin);

  it.each(['Austin', 'Austin, TX', 'Austin, TX, USA'])('resolves "%s" by place', async (input) => {
    const resolve = resolver();
    const result = await searchLocation(input, resolve);
    expect(result).toMatchObject({ ok: true, location: { label: 'Austin, Texas', source: 'search' } });
    expect(resolve).toHaveBeenCalledWith({ place: input.replace(/\s*,\s*/g, ', ') });
  });

  it('resolves coordinates', async () => {
    const resolve = resolver();
    await searchLocation('30.2672, -97.7431', resolve);
    expect(resolve).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
  });

  it('recognises postal codes the backend cannot search yet', async () => {
    const resolve = resolver();
    expect(await searchLocation('78701', resolve)).toEqual({ ok: false, reason: 'postalCodeUnsupported' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('returns a localization key for invalid input', async () => {
    expect(await searchLocation('95, 10', resolver())).toEqual({
      ok: false,
      reason: 'invalid',
      messageKey: 'validation.location.latitude.range',
    });
  });

  it('lets backend errors propagate to the caller', async () => {
    const resolve = vi.fn<LocationResolver>().mockRejectedValue(new Error('not found'));
    await expect(searchLocation('Nowhereville, ZZ', resolve)).rejects.toThrow('not found');
  });
});

describe('stored locations', () => {
  it('accept valid stored values and reject tampered ones', async () => {
    const { parseStoredLocation, parseStoredRecentLocations } = await import('./index');
    const austin = toSelectedLocation(fixtures.location.austin, 'search');
    expect(parseStoredLocation(JSON.parse(JSON.stringify(austin)))).toEqual(austin);
    expect(parseStoredLocation({ ...austin, latitude: 999 })).toBeUndefined();
    expect(parseStoredLocation({ ...austin, timeZone: '<script>' })).toBeUndefined();
    expect(parseStoredRecentLocations('nonsense')).toEqual([]);
  });
});
