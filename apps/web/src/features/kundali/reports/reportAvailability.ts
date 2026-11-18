import type { UnsupportedReason } from '@myvedicstar/contracts';

/**
 * KUN-17 reports: what the UI can honestly say today.
 *
 * The API counterpart (#57) is NOT BUILT. `POST /api/v1/kundali/{profileId}/reports` and
 * `GET /api/v1/kundali/{profileId}/reports/{reportId}` exist only in the Architect's refinement, with no implementation
 * behind them. So this module models availability and never fabricates a contract:
 *
 *   - there is no report request type here, no report id, no download URL field, no polling shape;
 *   - the only thing encoded is WHY the feature cannot be used yet, using the reason vocabulary that already exists
 *     (the same `UnsupportedReason` codes the rest of Kundali renders).
 *
 * When #57 lands, the missing pieces are named below in `REPORT_CONTRACT_GAPS` - that list is the handover, and it is
 * deliberately data rather than prose so it cannot quietly go stale in a comment.
 */

/** Report variants the refinement defines. No other variant exists. */
export const reportVariantValues = ['short', 'detailed'] as const;
export type ReportVariant = (typeof reportVariantValues)[number];

/**
 * What is missing before the UI can offer a real download.
 *
 * Each entry names a capability the UI would need and cannot invent. Rendering these keeps the surface honest: a user
 * (or the next agent) can see exactly what is outstanding rather than guessing at a disabled control's meaning.
 *
 * SCOPE: this is the DOWNLOAD-blocking list, not the complete set of gaps against #57. It names three; #57 has four.
 * The fourth is `revision` (a sourceRevision on the report status response), which is deliberately omitted here: it
 * is a freshness binding, so it blocks telling "regenerate" from "up to date", not downloading. It is a merge blocker
 * on the API contract (see the severity-split comment on api#57) but not a reason the download button cannot exist.
 * Do not read this array as the full handover - read it as "what stops a download control rendering".
 */
export const REPORT_CONTRACT_GAPS = [
  'endpoint-post-reports',
  'endpoint-get-report-status',
  'download-url',
] as const;
type ReportContractGap = (typeof REPORT_CONTRACT_GAPS)[number];

export interface ReportAvailability {
  available: boolean;
  /** Present only when unavailable. Reuses the existing reason codes rather than inventing a reports-specific one. */
  reason?: UnsupportedReason;
  gaps: readonly ReportContractGap[];
}

/**
 * Availability of the PDF download for this build.
 *
 * Returns `available: false` with `engine-unavailable`, which the catalog already words as "not built yet". That is
 * the truthful state: the server cannot generate a report, so the UI must not pretend it might.
 *
 * Note there is no branch that returns true. A function that can only return one value looks odd, but it is the point:
 * when the endpoint ships, this is the single place that changes, and its tests will fail loudly until it does.
 */
export function reportAvailability(): ReportAvailability {
  return {
    available: false,
    reason: 'engine-unavailable',
    gaps: REPORT_CONTRACT_GAPS,
  };
}
