import type { InterpretationDomain, InterpretationStatus } from './interpretationAvailability';

/**
 * A single domain interpretation as the UI renders it.
 *
 * `text` is present only for a ready section: a pending or failed one has nothing to show, and modelling an empty
 * string instead would make "no interpretation" indistinguishable from "an interpretation that says nothing".
 *
 * `factors` are the ids of the verified calculation results the interpretation is built from. The contract requires
 * every returned sentence to reference factors that exist in the input; showing them is the evidence half of
 * "evidence-based interpretations". They are rendered as identifiers, not translated, because they name calculation
 * outputs rather than describing them.
 */
interface DomainInterpretation {
  domain: InterpretationDomain;
  status: InterpretationStatus;
  text: string | null;
  factors: readonly string[];
}

/**
 * The set of domain interpretations for one profile revision.
 *
 * `sections` is keyed by domain in the component, so a missing domain is a section that was never returned rather
 * than one that returned nothing - the distinction the overview contract makes between absent and null.
 */
export interface InterpretationsResponse {
  sourceRevision: string;
  sections: readonly DomainInterpretation[];
}

/**
 * State for one domain after the response is reduced.
 *
 * A discriminated union rather than a bag of optionals, so a `ready` section cannot be constructed without text and a
 * `pending` one cannot carry it. The same technique the overview uses to make placeholder times unrepresentable.
 */
export type DomainView =
  | { domain: InterpretationDomain; status: 'ready'; text: string; factors: readonly string[] }
  | { domain: InterpretationDomain; status: 'pending' }
  | { domain: InterpretationDomain; status: 'failed' }
  | { domain: InterpretationDomain; status: 'absent' };

/**
 * Reduces a response into one view per domain the contract defines.
 *
 * Every domain in `interpretationDomainValues` gets an entry, in that order, so the page layout does not shift
 * depending on which sections the server happened to return. A domain the response omits is `absent`, which is a
 * fourth state and deliberately not folded into `failed`: nothing failed, the server simply did not speak to it.
 *
 * A `ready` section with no text is treated as `failed` rather than rendered as an empty paragraph - "ready" with
 * nothing to show is a contradiction, and the honest reading of it is that the interpretation did not arrive.
 */
export function toDomainViews(
  response: InterpretationsResponse | null,
  domains: readonly InterpretationDomain[],
): DomainView[] {
  return domains.map<DomainView>((domain) => {
    const section = response?.sections.find((candidate) => candidate.domain === domain);
    if (!section) {
      return { domain, status: 'absent' };
    }
    if (section.status === 'pending') {
      return { domain, status: 'pending' };
    }
    if (section.status === 'failed') {
      return { domain, status: 'failed' };
    }
    if (section.text === null || section.text.trim() === '') {
      return { domain, status: 'failed' };
    }
    return { domain, status: 'ready', text: section.text, factors: section.factors };
  });
}
