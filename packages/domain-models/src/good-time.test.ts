import { fixtures } from '@myvedicstar/testing';
import { describe, expect, it } from 'vitest';

import { buildGoodTimeView, defaultActivityKey, isFavorableTone, toneForStatus } from './index';

const general = fixtures.muhurta.goodTimes.austinGeneral; // Austin, 2026-10-20
const at = (localTime: string) => Date.parse(`${general.date}T${localTime}:00-05:00`);

describe('toneForStatus', () => {
  it.each([
    ['HighlyFavorable', 'highly-favorable'],
    ['Favorable', 'favorable'],
    ['Mixed', 'mixed'],
    ['Caution', 'caution'],
    ['Avoid', 'avoid'],
    ['SomethingNew', 'mixed'],
  ] as const)('%s → %s', (status, tone) => {
    expect(toneForStatus(status)).toBe(tone);
  });

  it('treats only the two favorable tones as favorable', () => {
    expect(
      ['highly-favorable', 'favorable', 'mixed', 'caution', 'avoid'].map((t) => isFavorableTone(t as never)),
    ).toEqual([true, true, false, false, false]);
  });
});

describe('buildGoodTimeView', () => {
  it("lists only the backend's Good Times in ascending start-time order", () => {
    const view = buildGoodTimeView(general, at('06:00'));
    const expected = general.segments
      .filter((segment) => general.goodTimes.includes(segment.id) && segment.isGoodTime)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    expect(view.goodTimes.map((item) => item.segment.id)).toEqual(expected.map((segment) => segment.id));
    expect(view.goodTimes.every((item) => item.segment.isGoodTime && item.conflicts.length === 0)).toBe(true);
    expect(view.goodTimes.every((item) => ['highly-favorable', 'favorable'].includes(item.tone))).toBe(true);
    expect(view.noGoodTime).toBeUndefined();
  });

  it('sorts shuffled periods chronologically without changing the response', () => {
    const response = structuredClone(general);
    response.segments.reverse();
    response.goodTimes.reverse();
    const original = structuredClone(response);
    const view = buildGoodTimeView(response);
    for (const list of [view.goodTimes, view.notRecommended, view.segments]) {
      const starts = list.map((item) => Date.parse(item.segment.start));
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    }
    expect(response).toEqual(original);
  });

  it('explains Good Times with supportive reasons and the conflicts they avoid', () => {
    const [best] = buildGoodTimeView(general, at('06:00')).goodTimes;
    expect(best!.supports.length).toBeGreaterThan(0);
    expect(best!.supports.every((reason) => !reason.code.endsWith('_CONFLICT'))).toBe(true);
    expect(best!.clearOf.map((reason) => reason.code)).toContain('NO_RAHU_KALAM_CONFLICT');
  });

  it('explains favorable periods the backend did not recommend because of a conflict', () => {
    const view = buildGoodTimeView(general, at('06:00'));
    expect(view.notRecommended.length).toBeGreaterThan(0);
    for (const item of view.notRecommended) {
      expect(item.segment.isGoodTime).toBe(false);
      expect(['mixed', 'caution', 'avoid']).toContain(item.tone);
      expect(item.conflicts.some((conflict) => conflict.withFavorable)).toBe(true);
      expect(
        item.supports.some((reason) => reason.code === 'ABHIJIT_MUHURTA' || reason.code === 'AMRIT_KALAM'),
      ).toBe(true);
    }
  });

  it('tells which segment is in progress today and the next Good Time', () => {
    const [first] = general.segments.filter((segment) => segment.isGoodTime);
    const before = buildGoodTimeView(
      { ...general, localToday: general.date },
      Date.parse(first!.start) - 60_000,
    );
    expect(before.next?.segment.id).toBe(first!.id);
    const during = buildGoodTimeView(
      { ...general, localToday: general.date },
      Date.parse(first!.start) + 60_000,
    );
    expect(during.now?.segment.id).toBe(first!.id);
    expect(during.next?.segment.id).not.toBe(first!.id);
  });

  it('has no now / next for another date', () => {
    const view = buildGoodTimeView(
      { ...general, localToday: '2026-10-19' },
      Date.parse('2026-10-19T08:00:00-05:00'),
    );
    expect(view.now).toBeUndefined();
    expect(view.next).toBeUndefined();
  });

  it('never promotes anything when the backend found no Good Time', () => {
    const excluded = fixtures.muhurta.goodTimes.hyderabadExcluded;
    const view = buildGoodTimeView(excluded, Date.parse(`${excluded.date}T12:00:00+05:30`));
    expect(view.goodTimes).toEqual([]);
    expect(view.next).toBeUndefined();
    expect(view.noGoodTime).toEqual({
      reason: 'DAY_EXCLUDED_FOR_ACTIVITY',
      message: excluded.noGoodTimeMessage,
    });
    expect(view.dayTone).toBe('avoid');
  });

  it('ignores goodTimes ids the backend did not also mark isGoodTime', () => {
    const tampered = structuredClone(general);
    tampered.goodTimes = [
      ...tampered.goodTimes,
      tampered.segments.find((segment) => !segment.isGoodTime)!.id,
    ];
    expect(buildGoodTimeView(tampered).goodTimes).toHaveLength(general.goodTimes.length);
  });
});

describe('defaultActivityKey', () => {
  const { activities } = fixtures.muhurta.activities;

  it('prefers an explicit, known request; then the backend default; then general', () => {
    expect(defaultActivityKey(activities, 'general', 'Travel')).toBe('travel');
    expect(defaultActivityKey(activities, 'general', 'skydiving')).toBe('general');
    expect(defaultActivityKey(activities, 'business', null)).toBe('business');
    expect(defaultActivityKey(activities, undefined)).toBe('general');
  });
});
