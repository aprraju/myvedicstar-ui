import type { SavedLocation, UserSettings } from '@myvedicstar/contracts';
import type { SelectedLocation } from '@myvedicstar/domain-models';
import { describe, expect, it } from 'vitest';

import { accountStartLocation, findSavedLocation } from './settings';

const austin: SavedLocation = {
  locationId: 'f85dddfa-2fb8-48c1-a3bf-36310c47f609',
  city: 'Austin',
  state: 'Texas',
  country: 'United States',
  countryCode: 'US',
  postalCode: '78701',
  latitude: 30.2672,
  longitude: -97.7431,
  timeZone: 'America/Chicago',
};
const hyderabad: SavedLocation = {
  ...austin,
  locationId: 'e96544af-55b1-458b-92e0-33044c47ad28',
  city: 'Hyderabad',
  state: 'Telangana',
  country: 'India',
  countryCode: 'IN',
  postalCode: null,
  latitude: 17.385,
  longitude: 78.4867,
  timeZone: 'Asia/Kolkata',
};
const picked = (overrides: Partial<SelectedLocation> = {}): SelectedLocation => ({
  id: 'search-1',
  label: 'Austin, Texas',
  fullName: 'Austin, Texas, United States',
  latitude: 30.27,
  longitude: -97.74,
  timeZone: 'America/Chicago',
  countryCode: 'US',
  source: 'search',
  city: 'Austin',
  region: 'Texas',
  country: 'United States',
  ...overrides,
});
const settings = (defaultLocation: SavedLocation | null): UserSettings => ({
  defaultTradition: null,
  defaultLocationId: defaultLocation?.locationId ?? null,
  defaultLocation,
  revision: 1,
});

describe('findSavedLocation', () => {
  it('matches identical coordinates in the same time zone', () => {
    expect(
      findSavedLocation(
        [hyderabad, austin],
        picked({ city: undefined, latitude: 30.2672, longitude: -97.7431 }),
      ),
    ).toBe(austin);
  });
  it('matches the same city, state and country found with different coordinates (case-insensitive)', () => {
    expect(findSavedLocation([austin], picked({ city: ' austin ', region: 'TEXAS' }))).toBe(austin);
  });
  it('falls back to country names when a country code is missing', () => {
    expect(findSavedLocation([{ ...austin, countryCode: null }], picked({ countryCode: undefined }))).toEqual(
      { ...austin, countryCode: null },
    );
  });
  it('treats other places, states, countries or time zones as new', () => {
    expect(findSavedLocation([austin], picked({ city: 'Round Rock' }))).toBeUndefined();
    expect(findSavedLocation([austin], picked({ region: 'Minnesota' }))).toBeUndefined();
    expect(findSavedLocation([austin], picked({ countryCode: 'CA', country: 'Canada' }))).toBeUndefined();
    expect(findSavedLocation([austin], picked({ timeZone: 'America/Denver' }))).toBeUndefined();
    expect(findSavedLocation([austin], picked({ city: undefined }))).toBeUndefined();
    expect(findSavedLocation(undefined, picked())).toBeUndefined();
  });
});

describe('accountStartLocation', () => {
  it('waits for settings', () => {
    expect(
      accountStartLocation({ data: undefined, isSuccess: false }, { data: [austin], isPending: false }),
    ).toBeUndefined();
  });
  it('prefers the default location without waiting for saved locations', () => {
    expect(
      accountStartLocation({ data: settings(austin), isSuccess: true }, { data: undefined, isPending: true }),
    ).toMatchObject({ id: austin.locationId, label: 'Austin, Texas, United States' });
  });
  it('uses the first saved location when no default is set, once the list has loaded', () => {
    const noDefault = { data: settings(null), isSuccess: true };
    expect(accountStartLocation(noDefault, { data: undefined, isPending: true })).toBeUndefined();
    expect(accountStartLocation(noDefault, { data: [hyderabad, austin], isPending: false })).toMatchObject({
      id: hyderabad.locationId,
    });
  });
  it('returns null (keep the existing behaviour) without saved locations or when they cannot be loaded', () => {
    const noDefault = { data: settings(null), isSuccess: true };
    expect(accountStartLocation(noDefault, { data: [], isPending: false })).toBeNull();
    expect(accountStartLocation(noDefault, { data: undefined, isPending: false })).toBeNull();
  });
});
