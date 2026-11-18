import type { KundaliTransitsSection } from '@myvedicstar/contracts';

/**
 * Fixtures for KUN-13, derived from the merged API contract at aprraju/myvedicstar `cc89b640` (PR #112).
 *
 * `transitsWithAbsences` is the shape that matters most: Saturn present but with unevaluated longitude and motion,
 * Jupiter absent entirely, and Sade Sati truncated at a search edge. A renderer that defaults any of those to zero or to
 * "direct" is wrong in three independent ways at once, so the fixture puts all three in one payload.
 */

const reference = '2026-11-18T12:00:00+00:00';
const computed = '2026-11-18T12:00:04+00:00';
const expires = '2026-11-19T00:00:00+00:00';

/** Saturn evaluated, Jupiter evaluated, Sade Sati present and complete. */
export const transitsComplete: KundaliTransitsSection = {
  referenceInstant: reference,
  timezone: 'Asia/Kolkata',
  computedAt: computed,
  expiresAt: expires,
  saturn: {
    graha: 'Saturn',
    sign: 'Pisces',
    longitude: 350.42,
    isRetrograde: false,
    windows: [
      { sign: 'Pisces', startUtc: '2025-03-29T00:00:00+00:00', endUtc: '2027-06-03T00:00:00+00:00' },
      { sign: 'Aries', startUtc: '2027-06-03T00:00:00+00:00', endUtc: '2029-08-07T00:00:00+00:00' },
    ],
  },
  jupiter: {
    graha: 'Jupiter',
    sign: 'Cancer',
    longitude: 104.16,
    isRetrograde: true,
    windows: [{ sign: 'Cancer', startUtc: '2026-06-02T00:00:00+00:00', endUtc: '2027-06-26T00:00:00+00:00' }],
  },
  sadeSati: {
    phase: 'Peak',
    active: true,
    moonSign: 'Aquarius',
    startUtc: '2025-03-29T00:00:00+00:00',
    endUtc: '2027-06-03T00:00:00+00:00',
    isPartial: false,
    phases: [
      {
        phase: 'Rising',
        sign: 'Capricorn',
        startUtc: '2023-01-17T00:00:00+00:00',
        endUtc: '2025-03-29T00:00:00+00:00',
      },
      {
        phase: 'Peak',
        sign: 'Aquarius',
        startUtc: '2025-03-29T00:00:00+00:00',
        endUtc: '2027-06-03T00:00:00+00:00',
      },
    ],
  },
  datedTransits: [
    { graha: 'Saturn', eventType: 'Ingress', sign: 'Pisces', atUtc: '2025-03-29T00:00:00+00:00' },
    { graha: 'Jupiter', eventType: 'Ingress', sign: 'Cancer', atUtc: '2026-06-02T00:00:00+00:00' },
  ],
  unsupported: [],
};

/**
 * The honest day-one shape: Saturn present but unevaluated in two fields, Jupiter absent, Sade Sati truncated.
 *
 * Every absence here is individually defensible and every one of them becomes a lie under a naive default.
 */
export const transitsWithAbsences: KundaliTransitsSection = {
  referenceInstant: reference,
  timezone: 'Asia/Kolkata',
  computedAt: computed,
  expiresAt: expires,
  saturn: {
    graha: 'Saturn',
    sign: 'Pisces',
    longitude: null,
    isRetrograde: null,
    windows: [],
  },
  jupiter: null,
  sadeSati: {
    phase: 'Rising',
    active: false,
    moonSign: 'Aquarius',
    startUtc: '2023-01-17T00:00:00+00:00',
    endUtc: '2025-03-29T00:00:00+00:00',
    isPartial: true,
    phases: [
      {
        phase: 'Rising',
        sign: 'Capricorn',
        startUtc: '2023-01-17T00:00:00+00:00',
        endUtc: '2025-03-29T00:00:00+00:00',
      },
    ],
  },
  datedTransits: [],
  unsupported: [{ path: 'transits.jupiter', reason: 'insufficient-data' }],
};
