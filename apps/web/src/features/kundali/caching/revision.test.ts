import { describe, expect, it } from 'vitest';

import {
  acceptResult,
  freshnessOf,
  identityOfKey,
  isHydratableQuery,
  type ResultIdentity,
  resultKey,
  sameIdentity,
} from './revision';

const config = {
  ayanamsa: 'Lahiri',
  houseSystem: 'whole-sign',
  engineVersion: '2.10.03',
  ruleSetVersion: 'r1',
};

const at = (revision: number, overrides: Partial<ResultIdentity> = {}): ResultIdentity => ({
  profileId: 'p1',
  revision,
  config,
  ...overrides,
});

describe('KUN-21 revision-aware freshness — freshness is bound to the revision, not to a clock', () => {
  it('treats a result as current when the revision and config match', () => {
    const outcome = freshnessOf(at(4), at(4), { planets: 'x' });
    expect(outcome.kind).toBe('current');
  });

  it('downgrades a result to stale when the revision moved, with no TTL involved', () => {
    // This is the whole point: nothing here consults elapsed time. Revision 4 data is not current for revision 5.
    const outcome = freshnessOf(at(5), at(4), { planets: 'x' });
    expect(outcome.kind).toBe('stale');
    if (outcome.kind !== 'stale') throw new Error('unreachable');
    expect(outcome.requested.revision).toBe(5);
    expect(outcome.computedFor.revision).toBe(4);
  });

  it('downgrades when only the calculation config changed, at the same revision', () => {
    const movedAyanamsa = { ...config, ayanamsa: 'Raman' };
    const outcome = freshnessOf(at(4), at(4, { config: movedAyanamsa }), 'v');
    expect(outcome.kind).toBe('stale');
  });

  it('downgrades when the engine version changed, so an upgrade cannot serve old output as current', () => {
    const upgraded = { ...config, engineVersion: '3.0.0' };
    const outcome = freshnessOf(at(4), at(4, { config: upgraded }), 'v');
    expect(outcome.kind).toBe('stale');
  });

  it('reports absent, not stale, when there is no result at all', () => {
    expect(freshnessOf(at(4), undefined, undefined).kind).toBe('absent');
    expect(freshnessOf(at(4), at(4), undefined).kind).toBe('absent');
  });

  it('never reports current without a known computed-for identity', () => {
    // A value with no provenance cannot be shown as current; that is how a key mistake would otherwise hide.
    expect(freshnessOf(at(4), undefined, 'v').kind).toBe('absent');
  });
});

describe('KUN-21 revision-aware freshness — a late response is rejected, not rendered', () => {
  it('accepts a response whose identity still matches', () => {
    expect(acceptResult(at(4), at(4))).toBe(true);
  });

  it('rejects a response for a revision the user has already moved past', () => {
    // Request started at revision 4; user edited the profile while it was in flight.
    expect(acceptResult(at(4), at(5))).toBe(false);
  });

  it('rejects a response whose config moved during the request', () => {
    expect(acceptResult(at(4), at(4, { config: { ...config, houseSystem: 'equal-house' } }))).toBe(false);
  });

  it('rejects a response for a different profile entirely', () => {
    expect(acceptResult(at(4), at(4, { profileId: 'p2' }))).toBe(false);
  });
});

describe('KUN-21 revision-aware freshness — keys', () => {
  it('produces different keys for different revisions of the same profile', () => {
    expect(resultKey('planets', at(4))).not.toEqual(resultKey('planets', at(5)));
  });

  it('produces different keys for different sections at the same revision', () => {
    expect(resultKey('planets', at(4))).not.toEqual(resultKey('dasha', at(4)));
  });

  it('produces the same key for the same identity, so caching still works', () => {
    expect(resultKey('planets', at(4))).toEqual(resultKey('planets', at(4)));
  });

  it('keeps the kundali prefix so invalidation by family still finds every section', () => {
    expect(resultKey('planets', at(4))[0]).toBe('kundali');
    expect(resultKey('dasha', at(9))[0]).toBe('kundali');
  });

  it('round-trips the identity it was built with', () => {
    const key = resultKey('planets', at(7));
    const recovered = identityOfKey(key);
    expect(recovered).toEqual({ revision: 7, config });
  });

  it('returns no identity for a key that does not carry one, so it can never be treated as current', () => {
    expect(identityOfKey(['kundali', 'planets', 'p1'])).toBeUndefined();
    expect(identityOfKey(['kundali', 'planets', 'p1', { revision: '4' }])).toBeUndefined();
  });
});

describe('KUN-21 revision-aware freshness — identity comparison', () => {
  it('is true only for an exactly matching identity', () => {
    expect(sameIdentity(at(4), at(4))).toBe(true);
    expect(sameIdentity(at(4), at(5))).toBe(false);
    expect(sameIdentity(at(4, { profileId: 'a' }), at(4, { profileId: 'b' }))).toBe(false);
  });
});

describe('KUN-21 revision-aware freshness — persistence is the most likely place for a wrong result', () => {
  const asQuery = (key: readonly unknown[]) => ({ queryKey: key }) as never;

  it('refuses to hydrate an entry with no identity block', () => {
    expect(isHydratableQuery(asQuery(['kundali', 'planets', 'p1']))).toBe(false);
  });

  it('refuses to hydrate an entry whose revision is not a non-negative integer', () => {
    const key = ['kundali', 'planets', 'p1', { ...config, revision: -1 }];
    expect(isHydratableQuery(asQuery(key))).toBe(false);
    const fractional = ['kundali', 'planets', 'p1', { ...config, revision: 1.5 }];
    expect(isHydratableQuery(asQuery(fractional))).toBe(false);
  });

  it('refuses an entry written by a build with a different key shape', () => {
    // An older build wrote keys without engineVersion; hydrating it would present old-engine output as current.
    const { engineVersion: _dropped, ...olderConfig } = config;
    const key = ['kundali', 'planets', 'p1', { ...olderConfig, revision: 4 }];
    expect(isHydratableQuery(asQuery(key))).toBe(false);
  });

  it('accepts a well-formed entry', () => {
    expect(isHydratableQuery(asQuery(resultKey('planets', at(4))))).toBe(true);
  });
});
