import type { KundaliPlanets } from '@myvedicstar/contracts';

/**
 * Test fixtures for the KUN-08 section.
 *
 * `planetsEnginePartial` is the day-one reality the section must serve: the engine returns positions for the Sun and
 * Moon only. The other seven grahas are listed with no facts and an `engine-unavailable` reason for each path, which is
 * what the API is expected to send — the fixture does not soften it, so the tests exercise the real unsupported path.
 */

const methods = {
  houseSystem: 'whole-sign',
  aspectMethod: 'parashari-full-partial',
} as const;

const conventions: KundaliPlanets['conventions'] = {
  ayanamsa: 'Lahiri',
  dignityScheme: 'parashara',
  combustionOrb: 'standard',
  aspectMethod: 'parashari-full-partial',
};

/** Every fact a row can carry, for a row that computed fully. */
const sunFull = {
  planet: 'sun' as const,
  longitude: 18.42,
  sign: 'Mesha',
  degreeInSign: 18.42,
  nakshatra: 'Bharani',
  pada: 3,
  house: 12,
  // Sun is never retrograde in fact; this fixture value is what the engine reported, and the row must show it verbatim.
  retrograde: true,
  combust: false,
  dignity: 'exalted' as const,
  relationships: ['friendly', 'neutral'],
  aspects: [
    { to: 'moon' as const, type: 'full' as const, orb: 4.2 },
    // No orb: the engine's method did not measure one, so the UI must not print 0°.
    { to: 'saturn' as const, type: 'opposition' as const },
  ],
  unsupported: [],
};

/** The day-one payload: sun and moon complete, everything else listed but unavailable. */
export const planetsEnginePartial: KundaliPlanets = {
  ...methods,
  conventions,
  planets: [
    sunFull,
    {
      planet: 'moon',
      longitude: 102.7,
      sign: 'Karka',
      degreeInSign: 12.7,
      nakshatra: 'Pushya',
      pada: 1,
      house: 3,
      retrograde: false,
      combust: false,
      dignity: 'own-sign',
      relationships: ['friendly'],
      aspects: [{ to: 'sun', type: 'conjunction', orb: 2.1 }],
      unsupported: [],
    },
    ...(['mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as const).map((planet) => ({
      planet,
      unsupported: [
        { path: 'sign', reason: 'engine-unavailable' as const },
        { path: 'degreeInSign', reason: 'engine-unavailable' as const },
        { path: 'nakshatra', reason: 'engine-unavailable' as const },
        { path: 'pada', reason: 'engine-unavailable' as const },
        { path: 'house', reason: 'engine-unavailable' as const },
        { path: 'dignity', reason: 'engine-unavailable' as const },
        { path: 'retrograde', reason: 'engine-unavailable' as const },
        { path: 'combust', reason: 'engine-unavailable' as const },
        { path: 'relationships', reason: 'engine-unavailable' as const },
        { path: 'aspects', reason: 'engine-unavailable' as const },
      ],
    })),
  ],
};

/** Unknown birth time: the time-dependent house is suppressed with its own reason, the sign is still definite. */
export const planetsUnknownTime: KundaliPlanets = {
  ...methods,
  conventions,
  planets: [
    {
      planet: 'sun',
      longitude: 18.42,
      sign: 'Mesha',
      degreeInSign: 18.42,
      nakshatra: 'Bharani',
      pada: 3,
      // No house at all: with no birth time there is no ascendant, so there is no house 12 to name.
      retrograde: false,
      dignity: 'exalted',
      unsupported: [{ path: 'house', reason: 'birth-time-unknown' }],
    },
  ],
};

/** Approximate birth time: houses are computable but qualified. */
export const planetsApproximateTime: KundaliPlanets = {
  ...methods,
  conventions,
  planets: [
    {
      planet: 'moon',
      sign: 'Karka',
      nakshatra: 'Pushya',
      pada: 1,
      unsupported: [
        { path: 'degreeInSign', reason: 'birth-time-approximate' },
        { path: 'house', reason: 'birth-time-approximate' },
      ],
    },
  ],
};

/**
 * Nakshatra known, pada not: the engine resolved the nakshatra but not which quarter. A real partial answer, and the row
 * must say "pada not available" rather than showing the nakshatra alone and letting the reader assume the pada was
 * resolved.
 */
export const planetsPadaMissing: KundaliPlanets = {
  ...methods,
  conventions,
  planets: [
    {
      planet: 'venus',
      sign: 'Tula',
      degreeInSign: 8.3,
      nakshatra: 'Swati',
      unsupported: [
        { path: 'pada', reason: 'engine-unavailable' },
        { path: 'house', reason: 'engine-unavailable' },
      ],
    },
  ],
};

/** A row missing a fact with no explanation: must still render as unavailable, never as a blank cell. */
export const planetsUnexplainedGap: KundaliPlanets = {
  ...methods,
  planets: [{ planet: 'jupiter', unsupported: [] }],
};

/** Nothing computed at all. */
export const planetsEmpty: KundaliPlanets = {
  ...methods,
  planets: [],
};
