import type { ReportResponse } from '@myvedicstar/contracts';

/**
 * Whether a finished report still describes the profile as it is now (ui#57, gap 4).
 *
 * This is the decision the `revision` field exists for. It is deliberately NOT `freshnessOf` from the caching slice:
 * that function compares a full `ResultIdentity` (profile, revision, and four calculation-config values), and a report
 * carries only `revision`. Reusing it here would require inventing the config values, which would make the comparison
 * look stronger than it is. One fact, one comparison.
 *
 * Three outcomes, and `unknown` is not a polite "probably current": a caller that cannot establish the profile's
 * current revision must not offer "regenerate" as though the report were stale, nor claim it is up to date.
 */
export type ReportFreshness =
  /** The report was generated from the revision the profile is at now. Nothing to do. */
  | { kind: 'current' }
  /** The profile has moved since. The report is superseded and regeneration is the offered action. */
  | { kind: 'stale'; reportRevision: number; profileRevision: number }
  /** No revision to compare — either the report has not settled or the profile's revision is not known yet. */
  | { kind: 'unknown'; because: 'not-settled' | 'profile-revision-unavailable' };

/**
 * Compares a report with the profile's current revision.
 *
 * Only a settled report can be stale: an in-flight report's revision is the revision it is being generated FROM, so
 * calling it stale mid-generation would show "regenerate" for work already under way.
 */
export function reportFreshness(
  report: ReportResponse,
  profileRevision: number | null | undefined,
): ReportFreshness {
  if (report.status !== 'ready' && report.status !== 'failed') {
    return { kind: 'unknown', because: 'not-settled' };
  }
  if (profileRevision === null || profileRevision === undefined) {
    return { kind: 'unknown', because: 'profile-revision-unavailable' };
  }
  if (report.revision === profileRevision) return { kind: 'current' };
  return { kind: 'stale', reportRevision: report.revision, profileRevision };
}

/** Whether regeneration should be offered: only for a settled report whose source revision has moved on. */
export function shouldOfferRegenerate(freshness: ReportFreshness): boolean {
  return freshness.kind === 'stale';
}
