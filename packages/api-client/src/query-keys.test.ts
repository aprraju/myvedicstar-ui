import { describe, expect, it } from 'vitest';

import { queryKeys } from './index';

const austin = { location: { place: 'Austin, TX' }, tradition: 'telugu', language: 'en' };

describe('queryKeys', () => {
  it('never share cached Panchang between places, traditions or languages', () => {
    const base = queryKeys.panchang.today(austin);
    expect(queryKeys.panchang.today({ ...austin, location: { place: 'Hyderabad' } })).not.toEqual(base);
    expect(queryKeys.panchang.today({ ...austin, tradition: 'tamil' })).not.toEqual(base);
    expect(queryKeys.panchang.today({ ...austin, language: 'te' })).not.toEqual(base);
    expect(queryKeys.panchang.date('2026-10-09', austin)).not.toEqual(
      queryKeys.panchang.date('2026-10-10', austin),
    );
    expect(queryKeys.panchang.month(2026, 10, austin)).not.toEqual(
      queryKeys.panchang.month(2026, 11, austin),
    );
  });

  it('treat the same place typed differently as one cache entry', () => {
    expect(queryKeys.panchang.today({ location: { place: '  austin, tx ' } })).toEqual(
      queryKeys.panchang.today({ location: { place: 'Austin, TX' } }),
    );
    expect(queryKeys.locations.resolve({ latitude: 30.27, longitude: -97.74 })).toEqual([
      'locations',
      'resolve',
      { place: null, latitude: 30.27, longitude: -97.74, timeZone: null },
    ]);
  });

  it('share the "panchang" prefix so every Panchang read can be invalidated together', () => {
    for (const key of [
      queryKeys.panchang.today(austin),
      queryKeys.panchang.tenDays(austin),
      queryKeys.panchang.year(2026, austin),
      queryKeys.panchang.traditions('en'),
      queryKeys.panchang.glossary('telugu', undefined),
    ]) {
      expect(key[0]).toBe(queryKeys.panchang.all[0]);
    }
  });

  it('include the free text of an "other" activity only for that activity, case-insensitively', () => {
    const other = queryKeys.muhurta.goodTimes({ ...austin, activity: 'other', otherText: ' Car Purchase ' });
    expect(other).toEqual(
      queryKeys.muhurta.goodTimes({ ...austin, activity: 'other', otherText: 'car purchase' }),
    );
    expect(other).not.toEqual(
      queryKeys.muhurta.goodTimes({ ...austin, activity: 'other', otherText: 'wedding' }),
    );
    expect(queryKeys.muhurta.goodTimes({ ...austin, activity: 'travel', otherText: 'ignored' })).toEqual(
      queryKeys.muhurta.goodTimes({ ...austin, activity: 'travel' }),
    );
    expect(queryKeys.muhurta.explanation({ ...austin, activity: 'travel' })[1]).toBe('explanation');
  });

  it('separate month summaries and best times by activity, range and count', () => {
    expect(queryKeys.muhurta.daySummaries('2026-10-01', 31, { ...austin, activity: 'travel' })).not.toEqual(
      queryKeys.muhurta.daySummaries('2026-10-01', 31, { ...austin, activity: 'wedding' }),
    );
    expect(queryKeys.muhurta.bestGoodTimes({ ...austin, count: 3, days: 30 })).not.toEqual(
      queryKeys.muhurta.bestGoodTimes({ ...austin, count: 5, days: 30 }),
    );
    expect(queryKeys.muhurta.activities('telugu', 'en')).toEqual(['muhurta', 'activities', 'telugu', 'en']);
  });

  it('scope other caches by language, window and signed-in user', () => {
    expect(queryKeys.traditions.list(undefined)).toEqual(['traditions', 'list', null]);
    expect(queryKeys.festivals.upcoming(austin, 90)).not.toEqual(queryKeys.festivals.upcoming(austin, 30));
    expect(queryKeys.auth.userInfo('u1')).not.toEqual(queryKeys.auth.userInfo('u2'));
  });

  it('rounds coordinates to 4 decimals so tiny GPS differences share one cache entry', () => {
    const at = (latitude: number, longitude: number) => ({
      location: { latitude, longitude, timeZone: 'America/Chicago' },
      tradition: 'all',
      language: 'en',
    });
    expect(queryKeys.panchang.month(2026, 10, at(30.627480707106724, -97.76246120407086))).toEqual(
      queryKeys.panchang.month(2026, 10, at(30.62749, -97.76247)),
    );
    expect(queryKeys.panchang.month(2026, 10, at(30.6275, -97.7625))).not.toEqual(
      queryKeys.panchang.month(2026, 10, at(30.6276, -97.7625)),
    );
  });
});
