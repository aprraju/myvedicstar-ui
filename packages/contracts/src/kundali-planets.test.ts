import { describe, expect, it } from 'vitest';

import { kundaliPlanetsSchema } from './kundali-planets';

const base = {
  houseSystem: 'whole-sign',
  aspectMethod: 'parashari-full-partial',
  planets: [],
};

describe('KUN-08 planets contract', () => {
  it('accepts a minimal payload with no planets', () => {
    expect(kundaliPlanetsSchema.safeParse(base).success).toBe(true);
  });

  it('requires a named house system and aspect method, so houses cannot be shown unnamed (AC2)', () => {
    const { houseSystem: _h, ...noHouse } = base;
    const { aspectMethod: _a, ...noAspect } = base;
    expect(kundaliPlanetsSchema.safeParse(noHouse).success).toBe(false);
    expect(kundaliPlanetsSchema.safeParse(noAspect).success).toBe(false);
    expect(kundaliPlanetsSchema.safeParse({ ...base, houseSystem: '' }).success).toBe(false);
  });

  it('rejects null for an absent fact, because absent and null are different statements', () => {
    const withNullFact = {
      ...base,
      planets: [{ planet: 'mars', sign: null, unsupported: [] }],
    };
    expect(kundaliPlanetsSchema.safeParse(withNullFact).success).toBe(false);
  });

  it('rejects an unsupported reason code the UI has no wording for', () => {
    const invented = {
      ...base,
      planets: [{ planet: 'mars', unsupported: [{ path: 'sign', reason: 'because' }] }],
    };
    expect(kundaliPlanetsSchema.safeParse(invented).success).toBe(false);
  });

  it('rejects out-of-range positions rather than clamping them', () => {
    const bad = {
      ...base,
      planets: [{ planet: 'sun', longitude: 361, degreeInSign: 30, pada: 5, house: 13, unsupported: [] }],
    };
    expect(kundaliPlanetsSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts an aspect without an orb and rejects an orb outside 0-180', () => {
    const noOrb = {
      ...base,
      planets: [{ planet: 'sun', aspects: [{ to: 'moon', type: 'full' }], unsupported: [] }],
    };
    expect(kundaliPlanetsSchema.safeParse(noOrb).success).toBe(true);

    const badOrb = {
      ...base,
      planets: [{ planet: 'sun', aspects: [{ to: 'moon', type: 'full', orb: 200 }], unsupported: [] }],
    };
    expect(kundaliPlanetsSchema.safeParse(badOrb).success).toBe(false);
  });

  it('rejects a dignity outside the closed set', () => {
    const bad = { ...base, planets: [{ planet: 'sun', dignity: 'brilliant', unsupported: [] }] };
    expect(kundaliPlanetsSchema.safeParse(bad).success).toBe(false);
  });
});
