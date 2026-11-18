import { isStrictRange, WALL_CLOCK_PATTERN } from './birth-time-window';

/**
 * The write payload for a birth time, and the single mapping function the tests target.
 *
 * This is deliberately SEPARATE from the overview read type: the read side carries a `certainty` per computed field,
 * the write side carries only what the user asserted. Sharing one shape would force one of them to hold fields it
 * cannot populate.
 */
export type BirthTimeWrite =
  | { birthTimeMode: 'exact'; birthTimeFrom: string; birthTimeTo: string; birthTime: string }
  | { birthTimeMode: 'approximate'; birthTimeFrom: string; birthTimeTo: string; birthTime: null }
  | { birthTimeMode: 'unknown'; birthTimeFrom: null; birthTimeTo: null; birthTime: null };

/** Which error, if any, blocks saving. Distinct codes so the UI can say something specific rather than "invalid". */
export type BirthTimeError =
  | { code: 'invalid-time'; field: 'from' | 'to' }
  | { code: 'range-not-ascending' }
  | { code: 'window-crosses-midnight' };

/**
 * Validates a draft and produces the wire payload, or the first blocking error.
 *
 * `unknown` emits nulls for every time field, so a sentinel cannot be serialised from this function even if a stale
 * draft value is still sitting in the form state.
 */
export function toBirthTimeWrite(
  mode: 'exact' | 'approximate' | 'unknown',
  from: string,
  to: string,
  /** True when the entered window is known to run past midnight, so the error names the real cause. */
  intendsNextDay = false,
): { ok: true; value: BirthTimeWrite } | { ok: false; error: BirthTimeError } {
  if (mode === 'unknown') {
    return {
      ok: true,
      value: { birthTimeMode: 'unknown', birthTimeFrom: null, birthTimeTo: null, birthTime: null },
    };
  }

  if (mode === 'exact') {
    if (!WALL_CLOCK_PATTERN.test(from)) return { ok: false, error: { code: 'invalid-time', field: 'from' } };
    return {
      ok: true,
      value: { birthTimeMode: 'exact', birthTimeFrom: from, birthTimeTo: from, birthTime: from },
    };
  }

  if (!WALL_CLOCK_PATTERN.test(from)) return { ok: false, error: { code: 'invalid-time', field: 'from' } };
  if (!WALL_CLOCK_PATTERN.test(to)) return { ok: false, error: { code: 'invalid-time', field: 'to' } };
  // Checked BEFORE the ordering assertion: a midnight-crossing window is not merely out of order, and saying so gives
  // the user the actual reason instead of "start must be before end".
  if (!isStrictRange(from, to)) {
    // Both cases are "to <= from", but they are different mistakes and deserve different messages. The caller tells us
    // which by setting `intendsNextDay`: the form knows whether the user accepted a suggestion that the window runs
    // past midnight, rather than this function guessing from the clock value.
    return { ok: false, error: { code: intendsNextDay ? 'window-crosses-midnight' : 'range-not-ascending' } };
  }

  return {
    ok: true,
    value: { birthTimeMode: 'approximate', birthTimeFrom: from, birthTimeTo: to, birthTime: null },
  };
}
