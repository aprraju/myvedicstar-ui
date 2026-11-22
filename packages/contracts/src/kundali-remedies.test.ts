import { describe, expect, it } from 'vitest';

import {
  kundaliRemediesSectionSchema,
  kundaliRemedyFindingStatusValues,
  parseRemedyFindingStatus,
  remediesSuppressedByStatus,
  remediesThatMayRender,
} from './kundali-remedies';

describe('KUN-16 remedy contract — the status is parsed, never assumed', () => {
  const section = {
    catalogVersion: '2026-11-01',
    items: [
      {
        findingCode: 'yoga:gaja-kesari',
        findingStatus: 'evaluated',
        category: 'observance',
        suggestion: 'Offer sesame on Saturdays.',
        tradition: 'Smarta',
        reference: 'Common practice.',
      },
      {
        findingCode: 'dosha:mangal',
        findingStatus: 'not-evaluated',
        category: 'fasting',
        suggestion: 'Observe a Tuesday fast.',
        tradition: 'Vaishnava',
        reference: 'Regional practice.',
      },
      {
        findingCode: 'yoga:future',
        findingStatus: 'provisional-unpublished',
        category: 'mantra',
        suggestion: 'Recite at dawn.',
        tradition: 'Smarta',
        reference: 'Common practice.',
      },
    ],
    unsupported: [{ path: 'dosha:mangal', reason: 'input-missing' }],
  };

  it('parses the four wire statuses the API defines', () => {
    expect(kundaliRemedyFindingStatusValues).toEqual([
      'evaluated',
      'not-evaluated',
      'withheld',
      'unknown-code',
    ]);
    expect(parseRemedyFindingStatus('evaluated')).toBe('evaluated');
    expect(parseRemedyFindingStatus(' Not-Evaluated ')).toBe('not-evaluated');
    expect(parseRemedyFindingStatus('withheld')).toBe('withheld');
    expect(parseRemedyFindingStatus('unknown-code')).toBe('unknown-code');
  });

  it('resolves an unrecognised status to unknown-code, never to evaluated', () => {
    // The failure this guards against: a status the client cannot read being treated as permission to render.
    expect(parseRemedyFindingStatus('provisional-unpublished')).toBe('unknown-code');
    expect(parseRemedyFindingStatus('')).toBe('unknown-code');
  });

  it('only evaluated items may render, and suppressed items are still reportable', () => {
    const parsed = kundaliRemediesSectionSchema.parse(section);

    expect(remediesThatMayRender(parsed).map((item) => item.findingCode)).toEqual(['yoga:gaja-kesari']);
    expect(
      remediesSuppressedByStatus(parsed).map((entry) => [entry.remedy.findingCode, entry.status]),
    ).toEqual([
      ['dosha:mangal', 'not-evaluated'],
      ['yoga:future', 'unknown-code'],
    ]);
  });

  it('rejects a section with no catalogue version, so freshness cannot be implied', () => {
    const { catalogVersion: _omitted, ...withoutVersion } = section;
    expect(kundaliRemediesSectionSchema.safeParse(withoutVersion).success).toBe(false);
  });

  it('rejects a remedy with no tradition or no source', () => {
    const base = section.items[0]!;
    expect(
      kundaliRemediesSectionSchema.safeParse({
        ...section,
        items: [{ ...base, tradition: '' }],
      }).success,
    ).toBe(false);
    expect(
      kundaliRemediesSectionSchema.safeParse({
        ...section,
        items: [{ ...base, reference: '' }],
      }).success,
    ).toBe(false);
  });
});
