import { describe, expect, it } from 'vitest';

import { kundaliAshtakavargaSchema, kundaliYogasSchema } from './index';

/**
 * Contract guards for KUN-10 and KUN-11.
 *
 * These tests exist because the UI's honesty depends on the schema refusing shapes it cannot render truthfully: a
 * transit finding without a date, an "indeterminate" verdict with no unknown condition, a bindu table that does not
 * reconcile. Each rejection here is a class of lie the interface cannot tell.
 */

const natalAssessment = {
  key: 'gaja-kesari:natal',
  family: 'gaja-kesari' as const,
  code: 'gaja-kesari',
  name: 'Gaja Kesari Yoga',
  scope: 'natal' as const,
  status: 'satisfied' as const,
  conditions: [{ code: 'c1', text: 'Jupiter in a kendra from the Moon', truth: 'true' as const }],
  supporting: [{ code: 's1', text: 'Jupiter in the 4th from the Moon' }],
  opposing: [],
  exceptions: [],
  cancellations: [],
  ruleSetVersion: 'yoga-2026.1',
};

const yogas = {
  availability: 'computed' as const,
  assessments: [natalAssessment],
  families: [{ family: 'gaja-kesari' as const, available: true, ruleSetVersion: 'yoga-2026.1' }],
  ruleSetVersions: ['yoga-2026.1'],
};

describe('KUN-10 yogas contract', () => {
  it('accepts a computed section', () => {
    expect(kundaliYogasSchema.safeParse(yogas).success).toBe(true);
  });

  it('accepts an unsupported section with a reason and no assessments', () => {
    const result = kundaliYogasSchema.safeParse({
      availability: 'unsupported',
      reason: 'rule-not-implemented',
      assessments: [],
      families: [{ family: 'raja', available: false, reason: 'rule-not-implemented' }],
      ruleSetVersions: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unsupported section without a reason', () => {
    const result = kundaliYogasSchema.safeParse({
      availability: 'unsupported',
      assessments: [],
      families: [],
      ruleSetVersions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a computed section that also carries an unavailability reason', () => {
    const result = kundaliYogasSchema.safeParse({ ...yogas, reason: 'engine-unavailable' });
    expect(result.success).toBe(false);
  });

  it('rejects a transit finding with no reference instant', () => {
    const result = kundaliYogasSchema.safeParse({
      ...yogas,
      assessments: [{ ...natalAssessment, scope: 'transit', referenceInstant: undefined }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a natal finding that carries a reference instant', () => {
    const result = kundaliYogasSchema.safeParse({
      ...yogas,
      assessments: [{ ...natalAssessment, referenceInstant: '2026-11-18T00:00:00Z' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an indeterminate verdict with no unknown condition', () => {
    const result = kundaliYogasSchema.safeParse({
      ...yogas,
      assessments: [{ ...natalAssessment, status: 'indeterminate' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a definite verdict that lists an unknown condition', () => {
    const result = kundaliYogasSchema.safeParse({
      ...yogas,
      assessments: [
        { ...natalAssessment, conditions: [{ code: 'c1', text: 'x', truth: 'unknown' }] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate assessment keys', () => {
    const result = kundaliYogasSchema.safeParse({
      ...yogas,
      assessments: [natalAssessment, natalAssessment],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unavailable family with no reason', () => {
    const result = kundaliYogasSchema.safeParse({
      ...yogas,
      families: [{ family: 'raja', available: false }],
    });
    expect(result.success).toBe(false);
  });
});

const bhinna = [
  { planet: 'sun' as const, bindus: [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4], total: 46 },
  { planet: 'moon' as const, bindus: [2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5], total: 50 },
];

const ashtakavarga = {
  availability: 'computed' as const,
  rulesVersion: 'ashtakavarga-2026.1',
  bhinna,
  sarva: [3, 5, 7, 9, 11, 13, 15, 9, 3, 5, 7, 9],
  totals: { perPlanet: { sun: 46, moon: 50 }, grandTotal: 96 },
  legend: { version: 'ashtakavarga-2026.1', name: 'Sarvashtakavarga' },
};

describe('KUN-11 ashtakavarga contract', () => {
  it('accepts a reconciled computed section', () => {
    expect(kundaliAshtakavargaSchema.safeParse(ashtakavarga).success).toBe(true);
  });

  it('accepts an unsupported section with a reason', () => {
    expect(
      kundaliAshtakavargaSchema.safeParse({ availability: 'unsupported', reason: 'rule-not-implemented' }).success,
    ).toBe(true);
  });

  it('rejects a sign array that is not twelve values long', () => {
    const result = kundaliAshtakavargaSchema.safeParse({
      ...ashtakavarga,
      bhinna: [{ ...bhinna[0], bindus: [1, 2, 3] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload whose sarva does not equal the per-sign sum of bhinna', () => {
    const result = kundaliAshtakavargaSchema.safeParse({
      ...ashtakavarga,
      sarva: [3, 5, 7, 9, 11, 13, 15, 9, 3, 5, 7, 99],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a row whose total disagrees with its own twelve values', () => {
    const result = kundaliAshtakavargaSchema.safeParse({
      ...ashtakavarga,
      bhinna: [{ ...bhinna[0], total: 47 }, bhinna[1]],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a computed section that is missing its legend', () => {
    const { legend: _omitted, ...withoutLegend } = ashtakavarga;
    expect(kundaliAshtakavargaSchema.safeParse(withoutLegend).success).toBe(false);
  });

  it('rejects a grand total that does not match the sarva row', () => {
    const result = kundaliAshtakavargaSchema.safeParse({
      ...ashtakavarga,
      totals: { perPlanet: { sun: 46, moon: 50 }, grandTotal: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative bindu count', () => {
    const result = kundaliAshtakavargaSchema.safeParse({
      ...ashtakavarga,
      bhinna: [{ ...bhinna[0], bindus: [-1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4], total: 44 }, bhinna[1]],
    });
    expect(result.success).toBe(false);
  });
});
