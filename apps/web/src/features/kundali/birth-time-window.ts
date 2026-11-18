/**
 * KUN-06 birth-time window rules.
 *
 * The write contract normalises to `birthTimeFrom`/`birthTimeTo` at HH:MM:SS:
 *   exact       -> from == to
 *   approximate -> both set, to > from strictly (a zero-length window is not an approximation)
 *   unknown     -> both null, no sentinel
 *
 * These helpers are pure so the rules are testable without a form, and so the form and any future caller cannot drift
 * apart on what "valid" means.
 */

/** Wall-clock time, second precision - exactly what the API stores (time without time zone). */
export const WALL_CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

/**
 * True when an approximate window crosses local midnight.
 *
 * A birth window is a range within ONE local day. `23:30 -> 00:30` is not "an hour later", it is a window that spans
 * two dates, and every derivation downstream (ascendant, dasha boundaries) would disagree about which day it belongs
 * to. The API rejects it and so does this check, with the same meaning - never silently clamped or widened.
 *
 * Compares wall-clock strings, so it is timezone-free: the caller supplies times already expressed in the profile's
 * zone. Comparing against the browser's zone would reject a range that is valid for the person it belongs to.
 */
export function crossesMidnight(from: string, to: string): boolean {
  if (!WALL_CLOCK_PATTERN.test(from) || !WALL_CLOCK_PATTERN.test(to)) return false;
  return to <= from;
}

/** True when the two endpoints describe a strict range rather than a single instant. */
export function isStrictRange(from: string, to: string): boolean {
  return WALL_CLOCK_PATTERN.test(from) && WALL_CLOCK_PATTERN.test(to) && to > from;
}
