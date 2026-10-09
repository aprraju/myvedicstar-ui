import { buildPanchangMonth, fixtures } from '@myvedicstar/testing';
import { describe, expect, it } from 'vitest';

import { addMonths, buildCalendarMonth, observanceOf, parseYearMonth, yearMonthOf } from './index';

const october = buildPanchangMonth(fixtures.panchang.austinTelugu, 2026, 10);
const at = (iso: string) => Date.parse(iso);

describe('buildCalendarMonth', () => {
  it('lays October 2026 out in Sunday-first weeks with padding', () => {
    const month = buildCalendarMonth(october, { year: 2026, month: 10 }, at('2026-10-15T12:00:00-05:00'));
    expect(month.days).toHaveLength(31);
    // 1 October 2026 is a Thursday: four empty cells before it.
    expect(month.weeks[0]!.slice(0, 4)).toEqual([null, null, null, null]);
    expect(month.weeks[0]![4]?.date).toBe('2026-10-01');
    expect(month.weeks.every((week) => week.length === 7)).toBe(true);
    expect(month.weeks.at(-1)!.filter(Boolean).at(-1)?.date).toBe('2026-10-31');
  });

  it('gives each day its Tithi at sunrise, General day status and observance from the backend', () => {
    const { days } = buildCalendarMonth(october, { year: 2026, month: 10 });
    expect(days[0]).toMatchObject({
      dayOfMonth: 1,
      observance: 'ekadashi',
      ratingName: 'Mixed',
      tone: 'mixed',
    });
    expect(days[0]!.tithi?.name).toBe('Shukla Ekadashi');
    expect(days[4]).toMatchObject({ observance: 'purnima' });
    expect(days[15]).toMatchObject({ observance: 'ekadashi' });
    expect(days[19]).toMatchObject({ observance: 'amavasya' });
    // The tile uses the General day status (goodTime), not the day-factor rating (Favorable / Caution on these days).
    expect(days[2]).toMatchObject({
      ratingName: 'Highly Favorable',
      tone: 'highly-favorable',
      observance: undefined,
    });
    expect(days[1]).toMatchObject({ ratingName: 'Avoid', tone: 'avoid' });
  });

  it('falls back to the day-factor rating for responses without a General day status', () => {
    const older = { ...october, days: october.days.map(({ goodTime: _ignored, ...day }) => day) };
    const { days } = buildCalendarMonth(older, { year: 2026, month: 10 });
    expect(days[2]).toMatchObject({ ratingName: 'Favorable', tone: 'favorable' });
    expect(days[1]).toMatchObject({ ratingName: 'Caution', tone: 'caution' });
  });

  it("marks the location's today", () => {
    const { days } = buildCalendarMonth(october, { year: 2026, month: 10 }, at('2026-10-15T23:30:00-05:00'));
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-10-15']);
  });

  it('keeps dates missing from the response as empty days', () => {
    const partial = { ...october, days: october.days.slice(0, 10) };
    const { days } = buildCalendarMonth(partial, { year: 2026, month: 10 });
    expect(days).toHaveLength(31);
    expect(days[20]).toMatchObject({
      date: '2026-10-21',
      panchang: undefined,
      tithi: undefined,
      tone: undefined,
    });
  });

  it('lays out a month with no data at all (loading)', () => {
    const month = buildCalendarMonth(undefined, { year: 2026, month: 2 });
    expect(month.days).toHaveLength(28);
    expect(month.days.some((d) => d.isToday)).toBe(false);
  });
});

describe('month helpers', () => {
  it.each([
    [{ year: 2026, month: 12 }, 1, { year: 2027, month: 1 }],
    [{ year: 2026, month: 1 }, -1, { year: 2025, month: 12 }],
    [{ year: 2026, month: 10 }, 0, { year: 2026, month: 10 }],
    [{ year: 2026, month: 10 }, -14, { year: 2025, month: 8 }],
  ])('addMonths(%o, %i) → %o', (from, delta, to) => {
    expect(addMonths(from, delta)).toEqual(to);
  });

  it.each([
    ['2026-10', { year: 2026, month: 10 }],
    ['2026-13', undefined],
    ['2026-1', undefined],
    ['<script>', undefined],
    [null, undefined],
  ])('parseYearMonth(%s)', (value, expected) => {
    expect(parseYearMonth(value)).toEqual(expected);
  });

  it('reads the month of a date', () => {
    expect(yearMonthOf('2026-10-15')).toEqual({ year: 2026, month: 10 });
  });

  it.each([
    [11, 'ekadashi'],
    [26, 'ekadashi'],
    [15, 'purnima'],
    [30, 'amavasya'],
    [12, undefined],
  ])('Tithi %i → %s', (number, observance) => {
    expect(observanceOf({ ...october.days[0]!.tithis[0]!, number })).toBe(observance);
  });
});
