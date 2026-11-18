import { describe, expect, it } from 'vitest';

import { crossesMidnight, isStrictRange } from './birth-time-window';
import { toBirthTimeWrite } from './birth-time-write';

describe('KUN-06 birth-time write mapping', () => {
  it('maps exact to from == to with birthTime set', () => {
    const result = toBirthTimeWrite('exact', '05:45:00', '');
    expect(result).toEqual({
      ok: true,
      value: {
        birthTimeMode: 'exact',
        birthTimeFrom: '05:45:00',
        birthTimeTo: '05:45:00',
        birthTime: '05:45:00',
      },
    });
  });

  it('maps a strict approximate range', () => {
    const result = toBirthTimeWrite('approximate', '14:10:00', '15:40:00');
    expect(result).toEqual({
      ok: true,
      value: {
        birthTimeMode: 'approximate',
        birthTimeFrom: '14:10:00',
        birthTimeTo: '15:40:00',
        birthTime: null,
      },
    });
  });

  it('emits nulls for unknown and never a sentinel', () => {
    const result = toBirthTimeWrite('unknown', '00:00:00', '00:00:00');
    expect(result).toEqual({
      ok: true,
      value: { birthTimeMode: 'unknown', birthTimeFrom: null, birthTimeTo: null, birthTime: null },
    });
    // Even with stale values in the form, no time is serialised.
    const json = JSON.stringify(result);
    expect(json).not.toContain('00:00:00');
  });

  it('rejects a zero-length approximate window, because to must be strictly greater', () => {
    // A zero-length window in the MORNING is an ordering mistake, not a wrap.
    expect(toBirthTimeWrite('approximate', '10:00:00', '10:00:00')).toEqual({
      ok: false,
      error: { code: 'range-not-ascending' },
    });
    // The same zero-length window after noon is read as a wrap, matching crossesMidnight. Either way it cannot save.
    expect(toBirthTimeWrite('approximate', '14:10:00', '14:10:00')).toEqual({
      ok: false,
      error: { code: 'window-crosses-midnight' },
    });
  });

  it('rejects a window that crosses midnight, distinctly from a mis-ordered one', () => {
    const crossing = toBirthTimeWrite('approximate', '23:30:00', '00:30:00');
    expect(crossing).toEqual({ ok: false, error: { code: 'window-crosses-midnight' } });
  });

  it('names a plain mis-ordering as not ascending', () => {
    // Morning-only reversal: no midnight involved.
    expect(toBirthTimeWrite('approximate', '09:00:00', '08:00:00')).toEqual({
      ok: false,
      error: { code: 'range-not-ascending' },
    });
  });

  it('reports which field is malformed', () => {
    expect(toBirthTimeWrite('exact', '5:45', '')).toEqual({
      ok: false,
      error: { code: 'invalid-time', field: 'from' },
    });
    expect(toBirthTimeWrite('approximate', '05:45:00', 'nonsense')).toEqual({
      ok: false,
      error: { code: 'invalid-time', field: 'to' },
    });
  });
});

describe('KUN-06 window rules', () => {
  it('detects a midnight-crossing window', () => {
    expect(crossesMidnight('23:30:00', '00:30:00')).toBe(true);
    expect(crossesMidnight('14:10:00', '15:40:00')).toBe(false);
    // Only a LATE start that ends earlier is a wrap. These are plain ordering mistakes, not midnight problems.
    expect(crossesMidnight('10:00:00', '10:00:00')).toBe(false);
    // After noon this IS read as a wrap: the start is late in the day, so the only sensible reading is past midnight.
    expect(crossesMidnight('15:40:00', '14:10:00')).toBe(true);
    // The boundary: starting at noon counts as late enough to wrap.
    expect(crossesMidnight('12:00:00', '11:00:00')).toBe(true);
    expect(crossesMidnight('11:59:59', '00:30:00')).toBe(false);
  });

  it('treats only to > from as a strict range', () => {
    expect(isStrictRange('14:10:00', '15:40:00')).toBe(true);
    expect(isStrictRange('15:40:00', '14:10:00')).toBe(false);
    expect(isStrictRange('10:00:00', '10:00:00')).toBe(false);
    expect(isStrictRange('nonsense', '15:40:00')).toBe(false);
  });

  it('accepts a full-day window that does not wrap', () => {
    expect(isStrictRange('00:00:00', '23:59:59')).toBe(true);
    expect(crossesMidnight('00:00:00', '23:59:59')).toBe(false);
  });
});
