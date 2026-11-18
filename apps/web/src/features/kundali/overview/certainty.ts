import type { KundaliOverview, UnsupportedReason } from '@myvedicstar/contracts';

/**
 * How a block on the overview is presented.
 *
 * This is deliberately a discriminated union and NOT `value?: string`. An `unavailable` block has no `value` field at
 * all, so a placeholder, a sentinel like '00:00' or an assumed sunrise cannot be passed to the renderer - the type
 * will not carry one. That is the difference between "we agree not to do that" and "it cannot compile".
 */
export type FieldView =
  | { kind: 'value'; value: string }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'unavailable'; reason: UnsupportedReason };

/** Maps a contract `unsupported` path to the reason the server gave for it. */
function reasonFor(overview: KundaliOverview, path: string): UnsupportedReason | undefined {
  return overview.unsupported.find((entry) => entry.path === path)?.reason;
}

/**
 * Resolves an optional block to a FieldView.
 *
 * The server is the single source of truth for availability: a block is shown when it is present, and its absence is
 * explained by the `unsupported` entry for that path. The UI never decides on its own that a field "should" have a
 * value, and never guesses a fallback reason - an absent block with no matching entry still renders as unavailable
 * with the engine reason, which is the honest default.
 */
export function resolveField<T>(
  overview: KundaliOverview,
  path: string,
  present: T | undefined,
  render: (value: T) => FieldView,
): FieldView {
  if (present !== undefined) {
    const view = render(present);
    // A block that is present is never downgraded to unavailable; the server decided it is computable.
    return view;
  }
  return { kind: 'unavailable', reason: reasonFor(overview, path) ?? 'engine-unavailable' };
}
