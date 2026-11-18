import type { KundaliCapabilities } from '@myvedicstar/contracts';

/**
 * A fixture shaped like the LIVE response, not like an invented minimal one.
 *
 * D60 is in `provisionalDivisionalCharts` and NOT in `supportedDivisionalCharts`. That is the case the whole feature
 * exists for: a half-degree cut needing arc-second Lagna accuracy, so a D60 placement near a boundary can be wrong. If a
 * test fixture puts D60 in both lists, or in neither, it cannot demonstrate the three-way distinction at all.
 */
export const capabilitiesFixture: KundaliCapabilities = {
  supportedDivisionalCharts: [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45],
  provisionalDivisionalCharts: [60],
  supportedShadbalaComponents: ['Sthana', 'Dig', 'Kala', 'Naisargika', 'Drik'],
  unsupportedShadbalaComponents: ['Chesta'],
  lunarNodeConvention: 'MeanNode',
  ascendantConvention: 'GeocentricTrueSidereal',
  minimumSupportedBirthDate: '1800-01-01',
  maximumSupportedBirthDate: '2200-12-31',
  unsupportedCapabilities: [
    'D60 and divisionals finer than D9 are returned provisional only, with a boundary distance; they are never asserted as definitive.',
    'Shadbala Chesta Bala is not computed; any Shadbala total is partial and is not a classical required-rupas verdict.',
  ],
};

/** A hollow boundary: nothing supported, nothing provisional. Used to prove absence is stated, not left blank. */
export const capabilitiesEmpty: KundaliCapabilities = {
  supportedDivisionalCharts: [],
  provisionalDivisionalCharts: [],
  supportedShadbalaComponents: [],
  unsupportedShadbalaComponents: [],
  lunarNodeConvention: 'MeanNode',
  ascendantConvention: 'GeocentricTrueSidereal',
  minimumSupportedBirthDate: '1800-01-01',
  maximumSupportedBirthDate: '2200-12-31',
  unsupportedCapabilities: [],
};
