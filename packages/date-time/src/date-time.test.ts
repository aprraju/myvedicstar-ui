import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayOffset,
  formatLocalDate,
  formatRangeForDay,
  formatTime,
  formatTimeRange,
  isWithin,
  localDateOf,
  msUntilNextLocalDay,
  startOfLocalDate,
  todayIn,
  zoneOffsetMinutes,
} from './index';

const austin = { timeZone: 'America/Chicago', locale: 'en-US' };

/** ICU separates AM/PM with a narrow no-break space (U+202F); compare with plain spaces. */
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);
const norm = (text: string) => text.split(NARROW_NO_BREAK_SPACE).join(' ');

describe('formatting in the selected location zone', () => {
  it('formats an instant in the location zone regardless of its offset', () => {
    // Same instant expressed in IST: must still display as Austin local time.
    expect(norm(formatTime('2026-09-29T20:52:00+05:30', austin))).toBe('10:22 AM');
    expect(formatTime('2026-09-29T10:22:00-05:00', { ...austin, hour12: false })).toBe('10:22');
  });

  it('formats a range', () => {
    expect(norm(formatTimeRange('2026-09-29T15:10:00-05:00', '2026-09-29T16:39:00-05:00', austin))).toBe(
      '3:10 PM – 4:39 PM',
    );
  });

  it('formats a local date without device time zone drift', () => {
    expect(formatLocalDate('2026-09-29', 'en-US')).toBe('Tuesday, September 29');
    expect(formatLocalDate('2026-01-01', 'en-US', 'medium')).toBe('Jan 1, 2026');
  });
});

describe('local dates', () => {
  it('differ between locations at the same instant', () => {
    const instant = '2026-09-29T20:00:00Z';
    expect(todayIn('America/Chicago', instant)).toBe('2026-09-29');
    expect(todayIn('Asia/Kolkata', instant)).toBe('2026-09-30');
  });

  it('detect periods that cross midnight', () => {
    // Amrit Kalam 03:06(+1) IST from the Hyderabad fixture.
    expect(dayOffset('2026-09-30T03:06:00+05:30', '2026-09-29', 'Asia/Kolkata')).toBe(1);
    expect(dayOffset('2026-09-29T11:42:00+05:30', '2026-09-29', 'Asia/Kolkata')).toBe(0);
  });

  it('add days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('check half-open intervals', () => {
    expect(isWithin('2026-09-29T10:00:00Z', '2026-09-29T10:00:00Z', '2026-09-29T11:00:00Z')).toBe(true);
    expect(isWithin('2026-09-29T11:00:00Z', '2026-09-29T10:00:00Z', '2026-09-29T11:00:00Z')).toBe(false);
  });
});

describe('daylight saving time', () => {
  it('reports offsets on both sides of the US fall-back transition', () => {
    expect(zoneOffsetMinutes('2026-11-01T05:30:00Z', 'America/Chicago')).toBe(-300); // 00:30 CDT
    expect(zoneOffsetMinutes('2026-11-01T08:30:00Z', 'America/Chicago')).toBe(-360); // 02:30 CST
    expect(zoneOffsetMinutes('2026-11-01T08:30:00Z', 'Asia/Kolkata')).toBe(330);
  });

  it('finds local midnight on DST transition days', () => {
    expect(new Date(startOfLocalDate('2026-11-01', 'America/Chicago')).toISOString()).toBe(
      '2026-11-01T05:00:00.000Z',
    );
    expect(new Date(startOfLocalDate('2026-11-02', 'America/Chicago')).toISOString()).toBe(
      '2026-11-02T06:00:00.000Z',
    );
    expect(new Date(startOfLocalDate('2026-03-08', 'America/Chicago')).toISOString()).toBe(
      '2026-03-08T06:00:00.000Z',
    );
    expect(new Date(startOfLocalDate('2026-03-09', 'America/Chicago')).toISOString()).toBe(
      '2026-03-09T05:00:00.000Z',
    );
  });

  it('handles zones where DST skips midnight', () => {
    // Chile springs forward at 24:00 → 01:00 on 2026-09-06.
    const start = startOfLocalDate('2026-09-06', 'America/Santiago');
    expect(localDateOf(start, 'America/Santiago')).toBe('2026-09-06');
    expect(localDateOf(start - 1, 'America/Santiago')).toBe('2026-09-05');
  });

  it('computes time until the next local day for an app left open overnight', () => {
    // 23:30 CDT on the eve of fall-back → 30 minutes to midnight.
    expect(msUntilNextLocalDay('America/Chicago', '2026-11-01T04:30:00Z')).toBe(30 * 60_000);
    // 23:59 IST.
    expect(msUntilNextLocalDay('Asia/Kolkata', '2026-09-29T18:29:00Z')).toBe(60_000);
  });

  it('keeps sunrise on the fall-back day in local time', () => {
    expect(norm(formatTime('2026-11-01T06:39:00-06:00', austin))).toBe('6:39 AM');
    expect(localDateOf('2026-11-01T01:30:00-06:00', 'America/Chicago')).toBe('2026-11-01');
  });
});

describe('formatRangeForDay', () => {
  it('marks ends that fall on the next day', () => {
    const text = formatRangeForDay(
      '2026-09-29T23:08:00-05:00',
      '2026-09-30T00:57:00-05:00',
      austin,
      '2026-09-29',
      '(next day)',
    );
    expect(norm(text)).toBe('11:08 PM – 12:57 AM (next day)');
  });
});
