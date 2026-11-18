import type { Query } from '@tanstack/react-query';

/**
 * Revision-aware caching for Kundali (KUN-21).
 *
 * The problem this solves is narrow and specific: a wall-clock TTL says "this response is 40 seconds old, it is fine",
 * but the inputs it was computed from may have changed in those 40 seconds. A Kundali result is a function of the
 * profile's birth snapshot AND its revision AND the calculation config, so freshness has to be bound to those values,
 * not to elapsed time. A TTL alone cannot tell a stale result from a fresh one.
 *
 * Three rules are enforced here rather than left to convention:
 *  - The cache key CONTAINS the input revision. A result computed from revision 4 is a different key from revision 5,
 *    so a stale result cannot be returned for a newer input even if it is still within its TTL.
 *  - A response that arrives after the inputs moved is REJECTED, not rendered. See `acceptResult`.
 *  - A revision-less result is never treated as current. See `isCurrentFor`.
 */

/** The calculation settings a persisted result was produced under. Changing any of them invalidates the result. */
interface CalculationConfig {
  ayanamsa: string;
  houseSystem: string;
  engineVersion: string;
  ruleSetVersion: string;
}

/**
 * The identity of one computed result: which profile, at which input revision, under which config.
 *
 * `revision` is the server's optimistic-concurrency revision for the profile, the same number the profile editor
 * sends back on replace. It is NOT a timestamp and must never be derived from one.
 */
export interface ResultIdentity {
  profileId: string;
  revision: number;
  config: CalculationConfig;
}

/**
 * A section cache key.
 *
 * The identity segment is a single object appended to the key so the whole thing can be inspected and invalidated by
 * prefix, and so two results that differ only by revision are genuinely different cache entries.
 */
export function resultKey(section: string, identity: ResultIdentity): readonly unknown[] {
  return [
    'kundali',
    section,
    identity.profileId,
    {
      revision: identity.revision,
      ayanamsa: identity.config.ayanamsa,
      houseSystem: identity.config.houseSystem,
      engineVersion: identity.config.engineVersion,
      ruleSetVersion: identity.config.ruleSetVersion,
    },
  ] as const;
}

/** True when two identities would produce the same result, i.e. share a cache entry. */
export function sameIdentity(a: ResultIdentity, b: ResultIdentity): boolean {
  return (
    a.profileId === b.profileId &&
    a.revision === b.revision &&
    a.config.ayanamsa === b.config.ayanamsa &&
    a.config.houseSystem === b.config.houseSystem &&
    a.config.engineVersion === b.config.engineVersion &&
    a.config.ruleSetVersion === b.config.ruleSetVersion
  );
}

/** What the UI may render for one section. There is no "probably fine" member. */
export type FreshnessOutcome<T> =
  /** The result matches the inputs on screen as of this render. */
  | { kind: 'current'; value: T }
  /** A result exists but the inputs have moved since. It is shown as previous, with the reason, never as current. */
  | { kind: 'stale'; value: T; requested: ResultIdentity; computedFor: ResultIdentity }
  /** Nothing usable. The section renders its own unavailable/error state; it does not render old data as new. */
  | { kind: 'absent' };

/**
 * Decides whether a result may be rendered as current.
 *
 * This is the heart of the slice. A component calls this with the identity it is currently asking for and the identity
 * the data it holds was actually computed under. If they differ, the old value is downgraded to `stale` rather than
 * silently passed through, and `stale` carries both identities so the UI can say what changed.
 *
 * Note the deliberate absence of an `expiresAt` comparison: a result whose TTL has not elapsed is still downgraded when
 * the revision moved. TTL and revision are independent conditions and both must hold.
 */
export function freshnessOf<T>(
  requested: ResultIdentity,
  computedFor: ResultIdentity | undefined,
  value: T | undefined,
): FreshnessOutcome<T> {
  if (value === undefined || computedFor === undefined) return { kind: 'absent' };
  if (sameIdentity(requested, computedFor)) return { kind: 'current', value };
  return { kind: 'stale', value, requested, computedFor };
}

/**
 * A response that arrived late must not overwrite a newer result.
 *
 * Two things can happen while a request is in flight: the user can edit the profile (revision moves), and a second
 * request can start for the newer revision. Either makes the first response obsolete, and rendering it would show a
 * result for inputs the user has already changed — the exact failure this slice exists to prevent.
 *
 * Returns true only when the response's identity still matches the identity in effect now.
 */
export function acceptResult(respondedFor: ResultIdentity, identityNow: ResultIdentity): boolean {
  return sameIdentity(respondedFor, identityNow);
}

/**
 * Whether a persisted entry may be hydrated.
 *
 * Persisted state outlives the page session, so it is the most likely source of a wrong-looking result. An entry is
 * hydratable only when its key carries an identity block that still matches, which also rejects anything written by an
 * older build with a different key shape.
 */
export function isHydratableQuery(query: Query): boolean {
  const [, section, , identity] = query.queryKey;
  if (typeof section !== 'string') return false;
  if (!identity || typeof identity !== 'object') return false;
  const candidate = identity as Record<string, unknown>;
  return (
    typeof candidate.revision === 'number' &&
    Number.isInteger(candidate.revision) &&
    candidate.revision >= 0 &&
    typeof candidate.ayanamsa === 'string' &&
    typeof candidate.houseSystem === 'string' &&
    typeof candidate.engineVersion === 'string' &&
    typeof candidate.ruleSetVersion === 'string'
  );
}

/**
 * The identity a cached entry was computed under, for comparison against the live one.
 * Returns undefined for a key that does not carry an identity, which callers must treat as "not current".
 */
export function identityOfKey(key: readonly unknown[]): Omit<ResultIdentity, 'profileId'> | undefined {
  const identity = key[3];
  if (!identity || typeof identity !== 'object') return undefined;
  const candidate = identity as Record<string, unknown>;
  if (
    typeof candidate.revision !== 'number' ||
    typeof candidate.ayanamsa !== 'string' ||
    typeof candidate.houseSystem !== 'string' ||
    typeof candidate.engineVersion !== 'string' ||
    typeof candidate.ruleSetVersion !== 'string'
  )
    return undefined;
  return {
    revision: candidate.revision,
    config: {
      ayanamsa: candidate.ayanamsa,
      houseSystem: candidate.houseSystem,
      engineVersion: candidate.engineVersion,
      ruleSetVersion: candidate.ruleSetVersion,
    },
  };
}
