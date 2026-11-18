import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type ResultIdentity } from './revision';
import { useRevisionAwareQuery } from './useRevisionAwareQuery';

const config = {
  ayanamsa: 'Lahiri',
  houseSystem: 'whole-sign',
  engineVersion: '2.10.03',
  ruleSetVersion: 'r1',
};

const identity = (revision: number): ResultIdentity => ({ profileId: 'p1', revision, config });

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

/** Rerenders the hook with a new identity, so a revision change mid-life is exercised realistically. */
function useHarness(props: { identity: ResultIdentity; load: (s: AbortSignal) => Promise<string> }) {
  return useRevisionAwareQuery({
    section: 'planets',
    identity: props.identity,
    load: props.load,
    staleTime: 5 * 60_000,
  });
}

describe('KUN-21 useRevisionAwareQuery — a revision move mid-render is handled explicitly', () => {
  it('keeps the previous value, but labels it stale, when the revision advances while data is on screen', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const load = vi.fn(async () => 'value-for-rev-4');

    const { result, rerender } = renderHook(
      (props: { identity: ResultIdentity; load: (s: AbortSignal) => Promise<string> }) => useHarness(props),
      { wrapper: wrapper(client), initialProps: { identity: identity(4), load } },
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.outcome.kind).toBe('current');

    // The user edits the profile: the revision moves to 5 while revision 4's data is still rendered.
    rerender({ identity: identity(5), load });

    // The documented behaviour: the previous value stays on screen but is no longer claimed to be current. Either it
    // is labelled stale with both identities, or the newer load has already replaced it — never 'current' with rev 4.
    const outcome = result.current.outcome;
    if (outcome.kind === 'current') {
      expect(outcome.value).toBe('value-for-rev-5');
    } else {
      expect(outcome.kind).toBe('stale');
      if (outcome.kind !== 'stale') throw new Error('unreachable');
      expect(outcome.computedFor.revision).toBe(4);
      expect(outcome.requested.revision).toBe(5);
    }
  });

  it('never reports current for a result computed under a different revision', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const load = vi.fn(async () => 'value-for-rev-4');

    const { result, rerender } = renderHook(
      (props: { identity: ResultIdentity; load: (s: AbortSignal) => Promise<string> }) => useHarness(props),
      { wrapper: wrapper(client), initialProps: { identity: identity(4), load } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ identity: identity(6), load });

    await waitFor(() => expect(result.current.outcome.kind).not.toBe('current'));
  });

  it('refetches for the new revision and then reports current again', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    let revision = 4;
    const load = vi.fn(async () => `value-for-rev-${revision}`);

    const { result, rerender } = renderHook(
      (props: { identity: ResultIdentity; load: (s: AbortSignal) => Promise<string> }) => useHarness(props),
      { wrapper: wrapper(client), initialProps: { identity: identity(4), load } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    revision = 5;
    rerender({ identity: identity(5), load });

    await waitFor(() => expect(result.current.outcome.kind).toBe('current'));
    if (result.current.outcome.kind !== 'current') throw new Error('unreachable');
    expect(result.current.outcome.value).toBe('value-for-rev-5');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not start a request while the identity is unknown', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const load = vi.fn(async () => 'x');
    const { result } = renderHook(
      () =>
        useRevisionAwareQuery({
          section: 'planets',
          identity: null,
          load,
          staleTime: 1000,
        }),
      { wrapper: wrapper(client) },
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.outcome.kind).toBe('absent');
    expect(load).not.toHaveBeenCalled();
  });
});
