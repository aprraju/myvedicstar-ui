import { ApiError } from '@myvedicstar/api-client';
import { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type ResultIdentity, resultKey } from './revision';
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

/**
 * KUN-21 requirement: a stale response must be REJECTED, not silently rendered.
 *
 * The server's mechanism for "the revision you asked for is no longer current" is a 409 (the same optimistic-concurrency
 * contract the profile editor already uses). Here that surfaces as ApiError kind 'conflict', and the section must show
 * an error state rather than any value.
 */
describe('KUN-21 server-rejected stale read (409)', () => {
  it('renders the conflict as an error state and never as data', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const load = vi.fn(async () => {
      throw new ApiError({ kind: 'conflict', status: 409 });
    });

    const { result } = renderHook(
      () =>
        useRevisionAwareQuery({
          section: 'planets',
          identity: identity(4),
          load,
          staleTime: 60_000,
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.status).toBe('error'));

    // The critical assertions: the kind is surfaced for the caller to explain, and NO value is available to render.
    expect(result.current.errorKind).toBe('conflict');
    expect(result.current.outcome.kind).toBe('absent');
  });

  it('does not retry a conflict, because retrying without re-reading cannot succeed', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const load = vi.fn(async () => {
      throw new ApiError({ kind: 'conflict', status: 409 });
    });

    const { result } = renderHook(
      () =>
        useRevisionAwareQuery({
          section: 'planets',
          identity: identity(4),
          load,
          staleTime: 60_000,
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the rejected revision out of the cache, so a later render cannot pick it up', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const load = vi.fn(async () => {
      throw new ApiError({ kind: 'conflict', status: 409 });
    });

    const { result } = renderHook(
      () =>
        useRevisionAwareQuery({
          section: 'planets',
          identity: identity(4),
          load,
          staleTime: 60_000,
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(client.getQueryData(resultKey('planets', identity(4)))).toBeUndefined();
  });
});
