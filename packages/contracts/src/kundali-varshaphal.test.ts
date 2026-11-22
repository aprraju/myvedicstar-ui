import { describe, expect, it } from 'vitest';

import type { VarshaphalResponse } from './kundali-varshaphal';
import { varshaphalResponseSchema, varshaphalState } from './kundali-varshaphal';

/**
 * Contract guards for the Varshaphal capability-gap surface (ui#123).
 *
 * The engine has no Varshaphal, so this section's day-one truth is "the engine cannot produce an annual chart". The tests
 * below exist to make the dishonesty impossible rather than merely absent: every payload here that carries annual values
 * the engine could not have produced must be a PARSE ERROR, and the only route to a renderable chart must be a payload
 * that says `computed` and survived the strict schema.
 *
 * A test that only rendered the gap state could pass while the contract still tolerated a fabricated chart beside it.
 * These assert the refusal instead.
 */

/** The day-one payload: the engine has no Varshaphal. No chart field, because a gap response has none. */
const capabilityGapPayload = () => ({
  availability: 'unsupported',
  reason: 'engine-unavailable',
});

/** A payload the API could produce once the engine grows the capability. Values are the engine's, verbatim. */
const computedPayload = () => ({
  availability: 'computed',
  chart: {
    annualYear: 2083,
    annualAscendant: "Mesha 11°24'",
    values: [
      { path: 'varshaphal/annual/sun', value: "Simha 4°02'" },
      { path: 'varshaphal/annual/moon', value: "Vrishabha 19°51'" },
    ],
    withheld: [{ path: 'varshaphal/annual/lagna-minute', reason: 'birth-time-unknown' }],
    revision: 'rev-42',
  },
});

describe('Varshaphal contract — the gap is a state, never an empty chart', () => {
  it('accepts the day-one capability gap', () => {
    expect(varshaphalResponseSchema.safeParse(capabilityGapPayload()).success).toBe(true);
  });

  it('accepts a computed chart with real values and a per-item withheld reason', () => {
    expect(varshaphalResponseSchema.safeParse(computedPayload()).success).toBe(true);
  });

  it('rejects a gap response that also carries a chart — "cannot compute" and "here is the result" cannot both hold', () => {
    const contaminated = { ...capabilityGapPayload(), chart: computedPayload().chart };
    expect(varshaphalResponseSchema.safeParse(contaminated).success).toBe(false);
  });

  it('rejects a gap response with no reason, rather than leaving it unexplained', () => {
    expect(varshaphalResponseSchema.safeParse({ availability: 'unsupported' }).success).toBe(false);
  });

  it('rejects a computed response with no chart', () => {
    expect(varshaphalResponseSchema.safeParse({ availability: 'computed' }).success).toBe(false);
  });

  it('rejects a chart with an empty value list — a chart of no values is not a chart', () => {
    const payload = computedPayload();
    payload.chart.values = [];
    expect(varshaphalResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects an unkeyed free-form "facts" bag, which is the shape that invites invented values', () => {
    // The endpoint that exists returns "annual chart facts" with no specified contents. This is exactly that shape, and
    // it must not parse: an object of unknown keys is where a renderer finds something plausible to print.
    const factsBag = { availability: 'computed', chart: { facts: { lagna: 'Mesha', year: '2083' } } };
    expect(varshaphalResponseSchema.safeParse(factsBag).success).toBe(false);
  });

  it('rejects a withheld value with no reason — a withheld value is not an omission', () => {
    const payload = computedPayload();
    payload.chart.withheld = [{ path: 'varshaphal/annual/sun' } as never];
    expect(varshaphalResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a chart with no revision binding, so it cannot sit outside freshnessOf', () => {
    const payload = computedPayload();
    delete (payload.chart as { revision?: string }).revision;
    expect(varshaphalResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects an unknown extra key on the chart instead of silently ignoring it', () => {
    const payload = { ...computedPayload(), chart: { ...computedPayload().chart, annualPositions: [] } };
    expect(varshaphalResponseSchema.safeParse(payload).success).toBe(false);
  });
});

describe('Varshaphal state — no route to a chart the API did not send', () => {
  it('renders the gap state as a capability gap carrying the server reason, with no chart', () => {
    const parsed = varshaphalResponseSchema.parse(capabilityGapPayload());
    const state = varshaphalState(parsed);
    expect(state.kind).toBe('capability-gap');
    if (state.kind !== 'capability-gap') throw new Error('unreachable');
    expect(state.reason).toBe('engine-unavailable');
    expect(state).not.toHaveProperty('chart');
  });

  it('renders no chart when there is no response at all', () => {
    expect(varshaphalState(undefined)).toEqual({ kind: 'unavailable' });
    expect(varshaphalState(null)).toEqual({ kind: 'unavailable' });
  });

  it('returns the chart when — and only when — the payload says computed', () => {
    const parsed = varshaphalResponseSchema.parse(computedPayload());
    const state = varshaphalState(parsed);
    expect(state.kind).toBe('chart');
  });

  it('never fabricates a chart from a gap payload, for every reason the contract allows', () => {
    const reasons: VarshaphalResponse['availability'][] = ['unsupported', 'stale', 'not-found', 'error'];
    const gapReasons = ['engine-unavailable', 'birth-time-unknown', 'unvalidated-reference'] as const;
    for (const availability of reasons) {
      for (const reason of gapReasons) {
        const parsed = varshaphalResponseSchema.parse({ availability, reason });
        const state = varshaphalState(parsed);
        expect(state.kind).toBe('capability-gap');
        expect(state).not.toHaveProperty('chart');
      }
    }
  });
});
