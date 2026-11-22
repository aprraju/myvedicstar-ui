import type { KundaliRemediesSection } from '@myvedicstar/contracts';

/**
 * Fixtures for KUN-16, derived from the shipped API contract at aprraju/myvedicstar `cdcb3fc`.
 *
 * `remediesMixed` is the shape that matters most: one remedy whose finding was evaluated (renderable), and three whose
 * findings were not — not-evaluated, withheld, and a status the client has no vocabulary for. A renderer that decides
 * for itself which of those to show gets three independent cases wrong at once, so the fixture puts them in one payload.
 */

/** Only `evaluated` findings carry remedies. */
export const remediesEvaluated: KundaliRemediesSection = {
  catalogVersion: '2026-11-01',
  items: [
    {
      findingCode: 'yoga:gaja-kesari',
      findingStatus: 'evaluated',
      category: 'observance',
      suggestion: 'Offer sesame during the Shani observances on Saturdays.',
      tradition: 'Smarta',
      reference: 'Common practice; cited in the temple observance notes, not a scriptural prescription.',
    },
    {
      findingCode: 'dosha:mangal',
      findingStatus: 'evaluated',
      category: 'fasting',
      suggestion: 'Observe a Tuesday fast during the period reported above.',
      tradition: 'Vaishnava',
      reference: 'Regional practice recorded in the family tradition notes.',
    },
  ],
  unsupported: [],
};

/** Empty, with nothing withheld: a real answer, not an error. */
export const remediesNoneApply: KundaliRemediesSection = {
  catalogVersion: '2026-11-01',
  items: [],
  unsupported: [],
};

/** Everything the API can send at once: renderable, suppressed by status, and reported as unavailable. */
export const remediesMixed: KundaliRemediesSection = {
  catalogVersion: '2026-11-01',
  items: [
    {
      findingCode: 'yoga:gaja-kesari',
      findingStatus: 'evaluated',
      category: 'observance',
      suggestion: 'Offer sesame during the Shani observances on Saturdays.',
      tradition: 'Smarta',
      reference: 'Common practice; cited in the temple observance notes, not a scriptural prescription.',
    },
    {
      findingCode: 'dosha:mangal',
      findingStatus: 'not-evaluated',
      category: 'fasting',
      suggestion: 'Observe a Tuesday fast.',
      tradition: 'Vaishnava',
      reference: 'Regional practice recorded in the family tradition notes.',
    },
    {
      findingCode: 'dosha:kaal-sarp',
      findingStatus: 'withheld',
      category: 'donation',
      suggestion: 'Donate black gram on the new moon.',
      tradition: 'Smarta',
      reference: 'Common practice in the temple observance notes.',
    },
    {
      findingCode: 'yoga:future-vocabulary',
      findingStatus: 'provisional-unpublished',
      category: 'mantra',
      suggestion: 'Recite the Gayatri at dawn.',
      tradition: 'Smarta',
      reference: 'Common practice.',
    },
  ],
  unsupported: [
    { path: 'dosha:mangal', reason: 'input-missing' },
    { path: 'dosha:kaal-sarp', reason: 'capability-gap' },
    { path: 'yoga:unknown-catalogue-entry', reason: 'catalogue-stale' },
  ],
};

/** Only suppressed items: no remedy may render, but the section must still explain itself. */
export const remediesAllSuppressed: KundaliRemediesSection = {
  catalogVersion: '2026-11-01',
  items: [
    {
      findingCode: 'dosha:mangal',
      findingStatus: 'not-evaluated',
      category: 'fasting',
      suggestion: 'Observe a Tuesday fast.',
      tradition: 'Vaishnava',
      reference: 'Regional practice recorded in the family tradition notes.',
    },
  ],
  unsupported: [],
};
