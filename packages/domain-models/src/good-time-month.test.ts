import { fixtures } from '@myvedicstar/testing';
import { describe, expect, it } from 'vitest';

import { buildBestGoodTimes, buildGoodTimeMonth, monthRange } from './good-time-month';

describe('Find a Good Time month view', () => {
  it('requests the whole month', () => {
    expect(monthRange({ year: 2026, month: 10 })).toEqual({ start: '2026-10-01', days: 31 });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ start: '2028-02-01', days: 29 });
  });

  it("lays out the backend's status per day in weeks, with today and past days marked", () => {
    const response = { ...fixtures.muhurta.daySummariesBusiness, localToday: '2026-10-02' };
    const month = buildGoodTimeMonth(response, { year: 2026, month: 10 });

    expect(month.weeks[0]!.slice(0, 4)).toEqual([null, null, null, null]); // 1 October 2026 is a Thursday
    expect(month.days).toHaveLength(31);
    expect(month.days.slice(0, 5).map((day) => day.tone)).toEqual([
      'highly-favorable',
      'highly-favorable',
      'mixed',
      'highly-favorable',
      'avoid',
    ]);
    expect(month.days[0]!.isPast).toBe(true);
    expect(month.days[1]!).toMatchObject({ isToday: true, isPast: false });
    // Only days the backend gave a Good Time.
    expect(month.daysWithGoodTimes.every((day) => day.summary!.goodTimeCount > 0)).toBe(true);
    expect(month.daysWithGoodTimes.map((day) => day.dayOfMonth)).not.toContain(3);
  });

  it('leaves days without a summary (loading) without a status', () => {
    const month = buildGoodTimeMonth(undefined, { year: 2026, month: 11 });
    expect(month.days).toHaveLength(30);
    expect(month.days.every((day) => day.tone === undefined && !day.isToday)).toBe(true);
  });
});

describe('next best good times', () => {
  it("keeps the backend's ranking and explains each option", () => {
    const items = buildBestGoodTimes(fixtures.muhurta.best.austinBusiness);
    expect(items.map((item) => [item.rank, item.date, item.tone])).toEqual([
      [1, '2026-10-02', 'highly-favorable'],
      [2, '2026-10-04', 'highly-favorable'],
      [3, '2026-10-12', 'highly-favorable'],
    ]);
    expect(items[0]!.supports.length + items[0]!.clearOf.length).toBeGreaterThan(0);
  });

  it('never shows an option the backend did not flag as a Good Time', () => {
    const response = structuredClone(fixtures.muhurta.best.austinBusiness);
    response.options[1]!.segment.isGoodTime = false;
    expect(buildBestGoodTimes(response).map((item) => item.rank)).toEqual([1, 3]);
    expect(buildBestGoodTimes(undefined)).toEqual([]);
  });
});
