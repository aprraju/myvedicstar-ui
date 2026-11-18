import type { KundaliOverview } from '@myvedicstar/contracts';

/**
 * Test fixtures derived from the binding KUN-05 contract only. Every field here exists in that contract; nothing is
 * added for convenience, so a test can never quietly depend on a shape the API does not promise.
 */

const conventions: KundaliOverview['conventions'] = {
  ephemerisProvider: 'swisseph',
  ephemerisVersion: '2.10.03',
  ayanamsa: 'Lahiri',
  houseSystem: 'Placidus',
  nodeType: 'mean',
  zodiac: 'sidereal',
};

/** The day-one state: birth details present, every computed block absent and explained as engine-unavailable. */
export const overviewEngineUnavailable: KundaliOverview = {
  birthDetails: {
    name: 'Asha',
    birthDate: '1990-04-12',
    birthTimeMode: 'exact',
    birthTime: '05:45',
    placeName: 'Hyderabad, Telangana, India',
    latitude: 17.385,
    longitude: 78.4867,
    timeZoneId: 'Asia/Kolkata',
  },
  unsupported: [
    { path: 'ascendant', reason: 'engine-unavailable' },
    { path: 'moonSign', reason: 'engine-unavailable' },
    { path: 'sunSign', reason: 'engine-unavailable' },
    { path: 'currentDasha', reason: 'engine-unavailable' },
  ],
  conventions,
};

/** Fully computed, for the value path. */
export const overviewComplete: KundaliOverview = {
  ...overviewEngineUnavailable,
  ascendant: { sign: 'Vrishabha', degreeWithinSign: 12.4, nakshatra: 'Rohini' },
  moonSign: 'Vrishabha',
  sunSign: 'Mesha',
  currentDasha: {
    lord: 'Shani',
    level: 'Mahadasha',
    startUtc: '2020-03-14T09:22:11Z',
    endUtc: '2039-03-14T09:22:11Z',
  },
  keyPlacements: [
    { graha: 'Chandra', sign: 'Vrishabha', house: 1, retrograde: false },
    { graha: 'Budha', sign: 'Mesha', house: 12, retrograde: true },
  ],
  unsupported: [],
};

/** Unknown birth time: the contract forbids any time field, and the time-dependent blocks are explained. */
export const overviewUnknownTime: KundaliOverview = {
  birthDetails: {
    name: 'Ravi',
    birthDate: '1985-11-02',
    birthTimeMode: 'unknown',
    placeName: 'Chennai, Tamil Nadu, India',
    latitude: 13.0827,
    longitude: 80.2707,
    timeZoneId: 'Asia/Kolkata',
  },
  unsupported: [
    { path: 'ascendant', reason: 'birth-time-unknown' },
    { path: 'currentDasha', reason: 'birth-time-unknown' },
  ],
  conventions,
};

/** Approximate birth time: an explicit window, and blocks that depend on the exact instant are explained. */
export const overviewApproximateTime: KundaliOverview = {
  birthDetails: {
    name: 'Kiran',
    birthDate: '1993-07-21',
    birthTimeMode: 'approximate',
    windowStart: '14:10',
    windowEnd: '15:40',
    placeName: 'Pune, Maharashtra, India',
    latitude: 18.5204,
    longitude: 73.8567,
    timeZoneId: 'Asia/Kolkata',
  },
  moonSign: 'Karka',
  unsupported: [{ path: 'ascendant', reason: 'birth-time-approximate' }],
  conventions,
};
