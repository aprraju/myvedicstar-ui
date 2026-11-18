import { isApiError } from '@myvedicstar/api-client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  freshnessOf,
  type FreshnessOutcome,
  identityOfKey,
  type ResultIdentity,
  resultKey,
  sameIdentity,
} from './revision';

/**
 * A refetch scheduling hint, in milliseconds.
 *
 * A plain number under a name that states its role. Deliberately NOT a branded type: branding it would reject every
 * existing `staleTime: 60_000` call site and force a cast at each one, which is churn without safety — a cast is
 * precisely what a caller would add without thinking. The name does the work: it appears in the signature, in every
 * editor hover, and in "go to definition", landing a reader on this comment.
 *
 * What it does NOT do: it does not make a result correct, and it must never be used to express "this data is safe to
 * show for N seconds". That claim belongs to input identity — see {@link freshnessOf} — not to a clock. Setting this to
 * a very large value does not permit showing an outdated result; {@link useRevisionAwareQuery} downgrades anything whose
 * identity no longer matches regardless of how much of this window remains. Setting it to 0 does not make a result
 * unsafe either: correctness is unaffected in both directions.
 *
 * The rule for reviewers: a new `staleTime` without a comment saying it affects scheduling only should be sent back.
 */
export type RefetchHint = number;

/** Every freshness decision in this module comes from identity. Nothing reads a clock. */
export const FRESHNESS_IS_IDENTITY = true as const;

export interface RevisionAwareOptions<T> {
  /** Section name, e.g. 'planets'. Part of the key, so sections do not collide. */
  section: string;
  /** The identity the UI currently wants. Changes when the profile, its revision, or the config changes. */
  identity: ResultIdentity | null;
  /**
   * Loads the section. Named `load`, not `fetch`, because the repository bans bare `fetch()` in app code: requests must
   * go through @myvedicstar/api-client. This callback is that client call, injected so the hook stays testable.
   */
  load: (signal: AbortSignal) => Promise<T>;
  /**
   * Scheduling hint only — see {@link RefetchHint}. Correctness is enforced by `freshnessOf`, never by this number.
   */
  staleTime: RefetchHint;
}

export interface RevisionAwareState<T> {
  status: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
  /** The outcome, already resolved against the live identity. Never render a value without checking its kind. */
  outcome: FreshnessOutcome<T>;
  errorKind: string | null;
  reload: () => void;
}

/** The last result shown as current, kept so a revision change can downgrade it instead of blanking the section. */
interface LastCurrent<T> {
  section: string;
  identity: ResultIdentity;
  value: T;
}

/**
 * Reads one Kundali section with revision-aware freshness.
 *
 * The case this exists for: the revision moves WHILE a result is on screen. The previous value must not keep rendering
 * as though it were current, and it must not vanish either — the user is looking at it. So the old value is downgraded
 * to `stale` and the section keeps showing it with an explicit refresh affordance until the new revision resolves.
 *
 * Why the identity is read from the cache key rather than tracked in a mutable variable: the data TanStack returns is
 * always the data stored under `queryKey`, so comparing that key's identity with the live one compares two immutable
 * values. A "the identity we started for" variable can be overwritten by a later request, which is how late responses
 * usually end up being judged against the wrong pair.
 *
 * Why `lastCurrent` is state and not a ref: it is read DURING render to decide what to show, so reading a ref would be
 * a read React is free to skip. It is updated in a guarded render-time setState, which React handles by re-rendering
 * immediately with the new value.
 */
export function useRevisionAwareQuery<T>(options: RevisionAwareOptions<T>): RevisionAwareState<T> {
  const { section, identity, load, staleTime } = options;

  const key = identity ? resultKey(section, identity) : ['kundali', section, 'idle'];

  const query = useQuery({
    queryKey: key,
    enabled: identity !== null,
    // Passed straight through to TanStack. It decides WHEN to refetch; it has no say in what may be RENDERED, which is
    // freshnessOf's job below. Nothing in this hook reads it back.
    staleTime,
    queryFn: ({ signal }) => load(signal),
  });

  const [lastCurrent, setLastCurrent] = useState<LastCurrent<T> | null>(null);

  const reload = () => void query.refetch();

  if (identity === null) {
    return { status: 'idle', outcome: { kind: 'absent' }, errorKind: null, reload };
  }

  if (query.isError) {
    return {
      status: 'error',
      outcome: { kind: 'absent' as const },
      errorKind: isApiError(query.error) ? query.error.kind : 'unknown',
      reload,
    };
  }

  const cachedIdentity = identityOfKey(key);
  const computedFor = cachedIdentity ? { profileId: identity.profileId, ...cachedIdentity } : undefined;
  let outcome = freshnessOf(identity, computedFor, query.data as T | undefined);

  // Remember a current value so it can survive a revision change as an explicit stale fallback rather than a blank.
  if (outcome.kind === 'current' && !sameIdentity(lastCurrent?.identity ?? identity, identity)) {
    setLastCurrent({ section, identity, value: outcome.value });
  } else if (outcome.kind === 'current' && lastCurrent?.section !== section) {
    setLastCurrent({ section, identity, value: outcome.value });
  }

  if (
    outcome.kind === 'absent' &&
    lastCurrent !== null &&
    lastCurrent.section === section &&
    !sameIdentity(lastCurrent.identity, identity)
  ) {
    outcome = {
      kind: 'stale',
      value: lastCurrent.value,
      requested: identity,
      computedFor: lastCurrent.identity,
    };
  }

  if (query.isPending) {
    return { status: 'loading', outcome, errorKind: null, reload };
  }

  return {
    status: query.isFetching ? 'refreshing' : 'ready',
    outcome,
    errorKind: null,
    reload,
  };
}
