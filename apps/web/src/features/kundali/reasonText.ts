import type { UnsupportedReason } from '@myvedicstar/contracts';
import type { MessageKey } from '@myvedicstar/localization';

/**
 * One catalog key per reason the API can send, as an exhaustive `Record`.
 *
 * The `Record<UnsupportedReason, MessageKey>` annotation IS the guard: adding a reason to
 * `unsupportedReasonValues` in @myvedicstar/contracts fails compilation here until the new reason has a key. Tests
 * catch a missing translation; only the type catches a missing branch at the boundary where the payload is consumed.
 *
 * This exists because a hand-maintained parallel list of reasons already shipped one defect: the schema accepted three
 * values while the API emitted five, so honest "computed but unproven" payloads became parse errors. Two hand-kept
 * lists have the same failure shape as the original bug.
 */
const REASON_KEYS: Record<UnsupportedReason, MessageKey> = {
  'engine-unavailable': 'kundali.reason.engine-unavailable',
  'birth-time-unknown': 'kundali.reason.birth-time-unknown',
  'birth-time-approximate': 'kundali.reason.birth-time-approximate',
  'requires-exact-birth-time': 'kundali.reason.requires-exact-birth-time',
  'unvalidated-reference': 'kundali.reason.unvalidated-reference',
};

/**
 * A reason code as a catalog key.
 *
 * Takes `string` rather than `UnsupportedReason` because the value comes off the wire and an unexpected code must
 * render as a generic sentence, not crash a section. The exhaustive map above is what guarantees every reason the
 * contract allows has a real key; this function only decides what to do with one it has never seen.
 */
export function reasonKey(reason: string): MessageKey {
  return (
    Object.prototype.hasOwnProperty.call(REASON_KEYS, reason)
      ? REASON_KEYS[reason as UnsupportedReason]
      : 'kundali.reason.unknown'
  ) as MessageKey;
}
