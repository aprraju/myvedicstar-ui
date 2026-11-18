import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type ResultIdentity } from './revision';
import { type RefetchHint, useRevisionAwareQuery } from './useRevisionAwareQuery';

/**
 * Issue #105: `staleTime` is a scheduling hint, never a correctness guarantee.
 *
 * These tests exist to fail if anyone ever makes `staleTime` load-bearing. Each one gives the hook an absurdly generous
 * `staleTime` — a number that, if it controlled correctness, would keep a result reading as current for a decade — and
 * then moves the input identity underneath it.
 *
 * If freshness ever became clock-based, these pass silently and the product starts showing stale data as current. That
 * is why they assert the OUTCOME ('stale'), not merely that nothing crashed.
 */

const config = {
  ayanamsa: 'Lahiri',
  houseSystem: 'whole-sign',
  engineVersion: '2.10.03',
  ruleSetVersion: 'r1',
};

const identity = (revision: number): ResultIdentity => ({ profileId: 'p1', revision, config });

/** Ten years. Long enough that a clock-based implementation could never fail these tests. */
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

describe('#105 staleTime cannot make a stale result current', () => {
  it('downgrades to stale when the revision moves, despite a ten-year staleTime', async () => {
    const client = newClient();
    let revision = 4;
    const load = vi.fn(async () => `value-for-rev-${revision}`);

    const { result, rerender } = renderHook(
      (props: { identity: ResultIdentity }) =>
        useRevisionAwareQuery({
          section: 'planets',
          identity: props.identity,
          load,
          staleTime: TEN_YEARS_MS as RefetchHint,
        }),
      { wrapper: wrapper(client), initialProps: { identity: identity(4) } },
    );

    await waitFor(() => expect(result.current.outcome.kind).toBe('current'));

    // The revision moves. A clock-based implementation would still consider this fresh for another decade.
    revision = 5;
    rerender({ identity: identity(5) });

    // Whatever happens next, the value must never be presented as current-for-revision-5 while it was computed for 4.
    await waitFor(() => {
      const outcome = result.current.outcome;
      if (outcome.kind === 'current') {
        expect(outcome.value).toBe('value-for-rev-5');
      } else {
        expect(outcome.kind).toBe('stale');
      }
    });
  });

  it('reports stale, not current, when the engine version changes under a huge staleTime', async () => {
    const client = newClient();
    const load = vi.fn(async () => 'value');

    const { result, rerender } = renderHook(
      (props: { identity: ResultIdentity }) =>
        useRevisionAwareQuery({
          section: 'planets',
          identity: props.identity,
          load,
          staleTime: TEN_YEARS_MS as RefetchHint,
        }),
      { wrapper: wrapper(client), initialProps: { identity: identity(4) } },
    );
    await waitFor(() => expect(result.current.outcome.kind).toBe('current'));

    // Same revision, different engine: an upgrade must not inherit the old window.
    rerender({ identity: { ...identity(4), config: { ...config, engineVersion: '3.0.0' } } });

    await waitFor(() => {
      const outcome = result.current.outcome;
      if (outcome.kind === 'current') {
        // Only acceptable if the refetch genuinely completed for the NEW identity.
        expect(load).toHaveBeenCalledTimes(2);
      } else {
        expect(outcome.kind).toBe('stale');
      }
    });
  });

  it('is unaffected in the other direction: a staleTime of zero does not make a current result unsafe', async () => {
    // The complementary misuse: assuming a small staleTime means "this data is unreliable". It does not. A matching
    // identity is current regardless, because nothing here reads the clock.
    const client = newClient();
    const load = vi.fn(async () => 'value');

    const { result } = renderHook(
      () =>
        useRevisionAwareQuery({
          section: 'planets',
          identity: identity(4),
          load,
          staleTime: 0 as RefetchHint,
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.outcome.kind).toBe('current'));
  });
});
