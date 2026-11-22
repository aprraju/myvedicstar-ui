import type { MessageKey } from '@myvedicstar/localization';

/**
 * KUN-15 Ashtakoota comparison — the single place the wire contract is consumed.
 *
 * **PROVISIONAL.** api#55 is still open; `git grep -il 'ashtakoota' origin/main -- '*.cs'` returns nothing and there is
 * no comparison route on the controller. The payload shape has therefore not shipped, and this module refuses to guess
 * it: a comparison response is parsed by `fromComparisonPayload`, which today returns
 * `{ kind: 'contract-not-available' }` for every input *including* a well-formed object.
 *
 * That is deliberate and it is the point. A comparison score a client cannot verify is worse than no comparison, and
 * the failing direction is chosen so a wrong guess cannot become a rendered number: the adapter has no branch that
 * produces a score from unparsed data.
 *
 * When api#55 lands, exactly one function changes: `fromComparisonPayload`. Nothing in `ComparisonCategoryRow`,
 * `ComparisonTable` or its tests refers to the wire shape, so the surface does not get rebuilt.
 */

/**
 * One category as the UI consumes it. This is the UI's own prop shape, not the wire shape: it exists so the rendering
 * and the determinacy rules can be written and tested before the contract exists.
 *
 * The union is closed on purpose. There is no `{ kind: 'score', value: number | null }` and no optional `score`:
 * absence of a score must be a different CONSTRUCTOR, not a different value, or a renderer can print 0 for it.
 */
export type CategoryScore =
  { kind: 'scored'; score: number; max: number } | { kind: 'indeterminate'; reason: IndeterminateReason };

/**
 * Why a category has no score.
 *
 * Every member is a stated cause, not a placeholder. `unknown` exists for a reason code this build has no vocabulary
 * for, and it still renders as "cannot be determined" rather than as anything numeric - the same rule the remedies
 * contract uses for an unreadable status.
 */
export type IndeterminateReason =
  'birth-time-unknown' | 'birth-time-approximate' | 'outside-tradition' | 'unknown';

export const indeterminateReasonValues: readonly IndeterminateReason[] = [
  'birth-time-unknown',
  'birth-time-approximate',
  'outside-tradition',
  'unknown',
] as const;

/** Maps a reason code to a catalog key, exhaustively: a new reason fails compilation until it has one. */
const REASON_KEYS: Record<IndeterminateReason, MessageKey> = {
  'birth-time-unknown': 'kundali.compare.reason.birthTimeUnknown',
  'birth-time-approximate': 'kundali.compare.reason.birthTimeApproximate',
  'outside-tradition': 'kundali.compare.reason.outsideTradition',
  unknown: 'kundali.compare.reason.unknown',
};

export function indeterminateReasonKey(reason: string): MessageKey {
  return Object.prototype.hasOwnProperty.call(REASON_KEYS, reason)
    ? REASON_KEYS[reason as IndeterminateReason]
    : REASON_KEYS.unknown;
}

/** One category row, as the table renders it. */
export interface ComparisonCategory {
  code: string;
  score: CategoryScore;
}

/** A whole comparison, as the section renders it. */
export interface ComparisonView {
  categories: ComparisonCategory[];
  /**
   * Null when any category is indeterminate. A total that silently omitted the indeterminate categories would be a
   * number the engine never produced, so the total is withheld rather than shrunk.
   */
  total: number | null;
  scoredMax: number;
}

/** What the adapter can return. There is no third arm that yields a view from unparsed data. */
export type ComparisonResult =
  | { kind: 'available'; view: ComparisonView }
  | { kind: 'contract-not-available'; reason: 'api-55-not-shipped' };

export const CONTRACT_NOT_AVAILABLE: ComparisonResult = {
  kind: 'contract-not-available',
  reason: 'api-55-not-shipped',
};

/**
 * The only function that will consume the api#55 payload.
 *
 * Today it always returns `CONTRACT_NOT_AVAILABLE`, including for a syntactically valid object. It is not a stub that
 * fell behind; it is the guard that keeps an invented field from reaching a renderer. Replace the body when the
 * contract ships, keep the return type.
 */
export function fromComparisonPayload(_payload: unknown): ComparisonResult {
  return CONTRACT_NOT_AVAILABLE;
}

/**
 * Whether a category may be displayed as a number.
 *
 * A predicate rather than an inline check, for the same reason `remediesThatMayRender` exists: the rule is asserted in
 * a test that can reach it, not re-implemented in each renderer.
 */
export function isScored(score: CategoryScore): score is Extract<CategoryScore, { kind: 'scored' }> {
  return score.kind === 'scored';
}

/**
 * The comparison total, or null when it cannot be stated.
 *
 * Returns null when ANY category is indeterminate: partial totals are how an indeterminate comparison becomes a
 * misleading score. It also returns null when a scored category exceeds its own maximum, which cannot be a real
 * engine result.
 */
export function comparisonTotal(categories: ComparisonCategory[]): number | null {
  if (categories.length === 0) return null;
  if (categories.some((category) => !isScored(category.score))) return null;
  let total = 0;
  for (const category of categories) {
    if (!isScored(category.score)) return null;
    if (category.score.score < 0 || category.score.score > category.score.max) return null;
    total += category.score.score;
  }
  return total;
}
