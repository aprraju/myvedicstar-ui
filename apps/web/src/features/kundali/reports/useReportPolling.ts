import type { ReportResponse } from '@myvedicstar/contracts';
import { isReportSettled } from '@myvedicstar/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Polls a report until it settles (ui#57).
 *
 * Two rules, each of which removes a class of bug the naive version has:
 *
 *  1. **Settled is decided by `isReportSettled` and nothing else.** There is deliberately no second "is it ready yet?"
 *     expression in this file: a duplicate condition is how "ready" and "finished" drift apart and a poller keeps
 *     calling a finished report, or stops on one that is still running.
 *  2. **A response that arrives after the caller moved on is DISCARDED**, by comparing the fetch sequence number rather
 *     than by trusting arrival order. Two overlapping requests can return out of order; rendering the older one would
 *     show a report state the user has already replaced.
 *
 * Nothing is cached. The report lives on the server until profile deletion, so holding a copy here would be a second,
 * quieter source of truth — and a stale one after any regeneration.
 */

/** How the poll stands. `idle` means no report has been requested in this session. */
export type ReportPollStatus = 'idle' | 'requesting' | 'polling' | 'settled' | 'error';

export interface ReportPollState {
  status: ReportPollStatus;
  /** The latest settled-or-in-flight report. Never a constructed value: it is exactly what the server returned. */
  report: ReportResponse | null;
  /** ApiError kind (or `unknown`) when the request or a poll failed. Distinct from a report whose status is `failed`. */
  errorKind: string | null;
  request: (input: {
    variant: ReportResponse['variant'];
    sections: readonly ReportResponse['sections'][number][];
  }) => void;
  reload: () => void;
}

export interface ReportPollOptions {
  /** Issues POST …/reports. Rejects with an ApiError the caller already understands. */
  createReport: (
    input: { variant: ReportResponse['variant']; sections: readonly string[] },
    signal: AbortSignal,
  ) => Promise<ReportResponse>;
  /** Issues GET …/reports/{reportId}. */
  readReport: (reportId: string, signal: AbortSignal) => Promise<ReportResponse>;
  /** Milliseconds between polls while unsettled. */
  intervalMs?: number;
  /** Injectable for tests: the only reason this file does not touch a timer directly. */
  delay?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined;
}

function defaultDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return defaultDelay(ms, signal);
}

export function useReportPolling(options: ReportPollOptions): ReportPollState {
  const { createReport, readReport, intervalMs = 2000, delay = abortableDelay } = options;
  const [status, setStatus] = useState<ReportPollStatus>('idle');
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [errorKind, setErrorKind] = useState<string | null>(null);

  /** Incremented by every new request, so a late response from an older one cannot write state. */
  const generation = useRef(0);
  const lastRequest = useRef<Parameters<NonNullable<ReportPollState['request']>>[0] | null>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  const run = useCallback(
    async (
      input: { variant: ReportResponse['variant']; sections: readonly string[] },
      reuse: ReportResponse | null,
    ) => {
      const mine = ++generation.current;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;

      const isMine = () => mine === generation.current && !controller.signal.aborted;

      setErrorKind(null);
      setStatus(reuse ? 'polling' : 'requesting');

      try {
        let current: ReportResponse = reuse ?? (await createReport(input, controller.signal));
        if (!isMine()) return;
        setReport(current);
        setStatus('polling');

        // Single loop, single condition. `isReportSettled` is the contract's own predicate, so this stops exactly when
        // the rest of the app considers the report finished.
        while (!isReportSettled(current.status)) {
          await delay(intervalMs, controller.signal);
          if (!isMine()) return;
          current = await readReport(current.reportId, controller.signal);
          if (!isMine()) return;
          setReport(current);
        }

        setStatus('settled');
      } catch (error) {
        if (!isMine()) return;
        const kind =
          typeof error === 'object' && error !== null && 'kind' in error
            ? String((error as { kind: unknown }).kind)
            : 'unknown';
        setErrorKind(kind);
        setStatus('error');
      }
    },
    [createReport, readReport, intervalMs, delay],
  );

  const request = useCallback<NonNullable<ReportPollState['request']>>(
    (input) => {
      lastRequest.current = input;
      setReport(null);
      void run(input, null);
    },
    [run],
  );

  const reload = useCallback(() => {
    if (!lastRequest.current) return;
    // Re-poll the report already in hand rather than asking the server for a new one: a retry is "check again", not
    // "generate again". Regeneration is a deliberate action with its own affordance (see staleness below).
    void run(lastRequest.current, report);
  }, [report, run]);

  return { status, report, errorKind, request, reload };
}
