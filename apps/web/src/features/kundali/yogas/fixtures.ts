import type { KundaliYogas, YogaFamilyCode } from '@myvedicstar/contracts';

/**
 * Fixtures derived from the KUN-10 contract only. Every field exists in that contract.
 *
 * The engine does not implement these families yet, so the day-one fixture is `yogasRuleNotImplemented`: an
 * unsupported section with a reason code and a per-family coverage list. It contains NO assessments and NO bindu-style
 * numbers - there is nothing here to mistake for a calculated finding.
 */

const allFamilies: YogaFamilyCode[] = [
  'raja',
  'dhana',
  'gaja-kesari',
  'panch-mahapurusha',
  'manglik',
  'kaal-sarp',
  'pitra',
];

const noFamiliesAvailable: KundaliYogas['families'] = allFamilies.map((family) => ({
  family,
  available: false,
  reason: 'rule-not-implemented',
}));

/** Day one: the section exists, the engine has no rule set for it, the reason says exactly that. */
export const yogasRuleNotImplemented: KundaliYogas = {
  availability: 'unsupported',
  reason: 'rule-not-implemented',
  assessments: [],
  families: noFamiliesAvailable,
  ruleSetVersions: [],
};

/** The calculation service did not answer - a different reason and a different message from rule-not-implemented. */
export const yogasEngineUnavailable: KundaliYogas = {
  ...yogasRuleNotImplemented,
  reason: 'engine-unavailable',
  families: allFamilies.map((family) => ({ family, available: false, reason: 'engine-unavailable' })),
};

/** Unknown birth time: the engine can be reached but cannot decide the time-dependent verdicts. */
export const yogasUnknownBirthTime: KundaliYogas = {
  availability: 'unsupported',
  reason: 'birth-time-unknown',
  assessments: [],
  families: allFamilies.map((family) => ({ family, available: false, reason: 'birth-time-unknown' })),
  ruleSetVersions: [],
};

/** Computed shape, used to prove real values drop in without a redesign. Values are engine-shaped, not astrological claims. */
export const yogasComputed: KundaliYogas = {
  availability: 'computed',
  assessments: [
    {
      key: 'gaja-kesari:natal',
      family: 'gaja-kesari',
      code: 'gaja-kesari',
      name: 'Gaja Kesari Yoga',
      scope: 'natal',
      status: 'satisfied',
      conditions: [
        { code: 'jupiter-kendra-from-moon', text: 'Jupiter in a kendra from the Moon', truth: 'true' },
        { code: 'jupiter-unafflicted', text: 'Jupiter not combust', truth: 'true' },
      ],
      supporting: [
        { code: 'jupiter-4th-from-moon', text: 'Jupiter in the 4th from the Moon' },
        { code: 'moon-strong', text: 'Moon in a friendly sign' },
      ],
      opposing: [],
      exceptions: [],
      cancellations: [],
      ruleSetVersion: 'yoga-2026.1',
    },
    {
      key: 'manglik:natal',
      family: 'manglik',
      code: 'manglik',
      name: 'Manglik Dosha',
      scope: 'natal',
      status: 'satisfied',
      conditions: [
        { code: 'mars-in-7th-from-lagna', text: 'Mars in the 7th from Lagna', truth: 'true' },
        { code: 'mars-in-own-sign', text: 'Mars in Aries, Scorpio or Capricorn', truth: 'false' },
      ],
      supporting: [{ code: 'mars-7th', text: 'Mars in the 7th house' }],
      opposing: [],
      exceptions: [{ code: 'mars-in-own-sign', text: 'Mars in its own sign is treated as cancelled' }],
      // A cancellation that holds is what distinguishes this row from a plain "satisfied".
      cancellations: [{ code: 'cancelled-by-own-sign', text: 'Cancelled: Mars in its own sign' }],
      ruleSetVersion: 'yoga-2026.1',
    },
    {
      key: 'kaal-sarp:natal',
      family: 'kaal-sarp',
      code: 'kaal-sarp',
      name: 'Kaal Sarp Yoga',
      scope: 'natal',
      status: 'indeterminate',
      conditions: [
        { code: 'all-planets-between-rahu-ketu', text: 'All planets between Rahu and Ketu', truth: 'unknown' },
      ],
      supporting: [],
      opposing: [],
      exceptions: [],
      cancellations: [],
      ruleSetVersion: 'yoga-2026.1',
    },
    {
      key: 'raja:transit',
      family: 'raja',
      code: 'raja-transit',
      name: 'Raja Yoga (transit activation)',
      scope: 'transit',
      status: 'not-satisfied',
      conditions: [{ code: 'jupiter-transits-9th', text: 'Jupiter transits the 9th from the Moon', truth: 'false' }],
      supporting: [],
      opposing: [{ code: 'jupiter-3rd-from-moon', text: 'Jupiter in the 3rd from the Moon' }],
      exceptions: [],
      cancellations: [],
      ruleSetVersion: 'yoga-2026.1',
      referenceInstant: '2026-11-18T00:00:00Z',
    },
  ],
  families: allFamilies.map((family) => ({
    family,
    available: true,
    ruleSetVersion: 'yoga-2026.1',
  })),
  ruleSetVersions: ['yoga-2026.1'],
};

/** Partially implemented engine: some families evaluated, the rest explained. */
export const yogasPartiallyImplemented: KundaliYogas = {
  availability: 'computed',
  assessments: yogasComputed.assessments.filter((row) => row.family === 'gaja-kesari' || row.family === 'manglik'),
  families: allFamilies.map((family) => ({
    family,
    available: family === 'gaja-kesari' || family === 'manglik',
    reason: family === 'gaja-kesari' || family === 'manglik' ? undefined : 'rule-not-implemented',
    ruleSetVersion: family === 'gaja-kesari' || family === 'manglik' ? 'yoga-2026.1' : undefined,
  })),
  ruleSetVersions: ['yoga-2026.1'],
};
