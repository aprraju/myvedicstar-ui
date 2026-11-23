import { z } from 'zod';

/**
 * KUN-17 report contract bindings (api#57, UI half).
 *
 * Bound field-by-field to the report contract that has actually landed in aprraju/myvedicstar
 * (`src/MyVedicStar.Kundali.Shared/KundaliContracts.cs`, `src/MyVedicStar.Kundali.Api/Contracts/KundaliContracts.cs`,
 * commit 340a6c0 and later). Every name and every closed set below exists in the C# records — the section ids are
 * `KundaliSections.All` (KundaliContracts.cs:126-127, server order), the reason codes are `KundaliFailureReasons`
 * (KundaliContracts.cs:11-21, six codes, no additions). Nothing here is invented from the #27 refinement, and where the
 * C# shape differs from what the refinement asked for, the difference is recorded in the PR rather than smoothed over.
 *
 * The four UI gaps this module closes are the four that would otherwise let the client drift silently:
 *
 *  1. **Status has no catch-all.** `queued | running | ready | failed` is exhaustive, so a status the client does not
 *     know is a PARSE ERROR rather than a string that falls through to a generic branch. A server that adds a state
 *     must be met with a client change, not with a shrug.
 *  2. **Failure reasons are a closed catalogue with a render mapping.** A reason outside the published catalogue is
 *     still representable — the C# side made the same ruling in api#132, where `Unrecognised` carries the original
 *     code — but it renders as an explicit "unrecognised" message, never as raw server text.
 *  3. **Section ids are one fixed const list used by BOTH the request and the render path.** A typo is a compile error,
 *     not a silently empty tab. The list matches the published `reportSections` on the capabilities response.
 *  4. **Revision is carried on POST and GET**, so a completed report is `freshnessOf`-comparable and the UI can tell
 *     "regenerate" from "up to date" without guessing.
 */

/**
 * Report variants. `short` and `detailed` differ in how much of a section is rendered, never in which sections are
 * available (see `KundaliReportVariants`), so the client never pairs a variant with a section list of its own choosing.
 */
export const reportVariantValues = ['short', 'detailed'] as const;
export const reportVariantSchema = z.enum(reportVariantValues);
export type ReportVariant = z.infer<typeof reportVariantSchema>;

/**
 * Report lifecycle — exhaustive, with NO catch-all member.
 *
 * There is deliberately no `stale` member, and that mirrors the server: a report built from a superseded revision is
 * not a distinct state, it is a report whose `revision` no longer equals the profile's. Adding one here would make the
 * same fact expressible two ways and neither authoritative. `isReportSettled` is the single place that decides when
 * polling stops.
 */
export const reportStatusValues = ['queued', 'running', 'ready', 'failed'] as const;
export const reportStatusSchema = z.enum(reportStatusValues);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

/** True once generation is finished, successfully or not — the condition a poller waits for. */
export function isReportSettled(status: ReportStatus): boolean {
  return status === 'ready' || status === 'failed';
}

/** True while a poll is still productive. The complement of `isReportSettled`, stated so call sites read as intent. */
export function isReportInProgress(status: ReportStatus): boolean {
  return !isReportSettled(status);
}

/**
 * The closed set of section ids a report may request.
 *
 * One const list, used by the request payload and by the render path, so the two cannot disagree: a section id that is
 * not in this tuple cannot be sent AND cannot be rendered, and a typo fails compilation instead of producing a tab that
 * is silently empty. The tuple is bound to the server's published `reportSections` (capabilities response) — see
 * `reportSectionsDisagreeing`, which is what makes a server-side addition a visible failure rather than a quiet drift.
 */
export const reportSectionValues = [
  'overview',
  'charts',
  'planets',
  'dashas',
  'yogas',
  'ashtakavarga',
  'bala',
  'transits',
  'interpretations',
] as const;
export const reportSectionSchema = z.enum(reportSectionValues);
export type ReportSection = z.infer<typeof reportSectionSchema>;

/**
 * Failure reason codes the report surface can render: exactly the six in `KundaliFailureReasons`
 * (KundaliContracts.cs:11-21). No proposed or aspirational codes are listed — a code the server cannot emit would be a
 * client asserting a vocabulary the wire does not have, and every one of those would have to be removed again the moment
 * it turned out never to ship.
 *
 * `superseded_by_profile_edit` is present because it is the one that matters most here: it is why a report the user
 * asked for is refused rather than shown against inputs that no longer exist.
 */
export const reportFailureReasonValues = [
  'engine_error',
  'ephemeris_unavailable',
  'timezone_unresolvable',
  'unsupported_capability',
  'birth_date_out_of_range',
  'superseded_by_profile_edit',
] as const;
export const reportFailureReasonSchema = z.enum(reportFailureReasonValues);
export type ReportFailureReason = z.infer<typeof reportFailureReasonSchema>;

/**
 * The failure entry as the API sends it: `{ path, reason }`.
 *
 * `reason` is a plain string on the wire and stays one here. That is not a weakening: api#132 made the same ruling on
 * the server — the set of reason strings is open, and a row written before a code existed can hold anything — so the
 * client's job is to render an unknown reason EXPLICITLY (see `reportFailureReasonKey`) rather than to reject the whole
 * report because one detail code is new. Rejecting would turn "a reason we cannot name" into "no report at all", which
 * is the silent-absence failure this surface exists to avoid.
 *
 * That is a real difference from an invented-and-closed field, so it is recorded rather than hidden: the closed set
 * guards what the CLIENT asserts about reasons, the open wire string guards what the SERVER can tell us about a failure
 * it did produce. Both can be true at once, and this split is why.
 */
export const reportFailureSchema = z
  .object({
    path: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();
export type ReportFailure = z.infer<typeof reportFailureSchema>;

/**
 * The report state as returned by POST (202) and GET (200).
 *
 * `revision` is required, not optional: a report without it cannot be compared with the profile's current revision,
 * and "cannot tell regenerate from up to date" is exactly gap 4. `downloadExpiresAt` is the EFFECTIVE expiry (the
 * earlier of the issue window and the report's own lifetime), so a client that checks it agrees with a server that
 * enforces it.
 */
export const reportResponseSchema = z
  .object({
    reportId: z.string().uuid(),
    profileId: z.string().uuid(),
    variant: reportVariantSchema,
    sections: z.array(reportSectionSchema).min(1),
    status: reportStatusSchema,
    revision: z.number().int().nonnegative(),
    requestedAtUtc: z.string().min(1),
    completedAtUtc: z.string().min(1).nullable(),
    downloadUrl: z.string().min(1).nullable(),
    downloadExpiresAtUtc: z.string().min(1).nullable(),
    failures: z.array(reportFailureSchema),
  })
  .strict();
export type ReportResponse = z.infer<typeof reportResponseSchema>;

/**
 * The report request body. `sections` is non-empty and drawn from the one const list, so an empty selection is a
 * caller error rather than a request for "everything" — defaulting it would make a mistake look deliberate.
 */
export const reportRequestSchema = z
  .object({
    variant: reportVariantSchema,
    sections: z.array(reportSectionSchema).min(1),
    locale: z.string().min(1).optional(),
  })
  .strict();
export type ReportRequest = z.infer<typeof reportRequestSchema>;

/** Section ids the server publishes that this client does not know about — a real disagreement, not a formatting one. */
export function reportSectionsUnknownToClient(published: readonly string[]): readonly string[] {
  return published.filter((id) => !(reportSectionValues as readonly string[]).includes(id));
}

/** Section ids this client would send that the server does not publish. Both directions matter, for different reasons. */
export function reportSectionsNotPublishedByServer(published: readonly string[]): readonly ReportSection[] {
  return reportSectionValues.filter((id) => !published.includes(id));
}

/**
 * The render mapping for failure reasons: one catalog key per reason the client recognises.
 *
 * The `Record<ReportFailureReason, MessageKey>` annotation is the guard, not a convenience. Adding a reason to
 * `reportFailureReasonValues` fails compilation here until it has a key — which is the property this module exists to
 * provide: a new reason cannot surface as raw server text, because there is no code path from an unrendered code to the
 * screen.
 *
 * An UNRECOGNISED code (anything not in the union) maps to a fixed "unrecognised" key that also carries the original code
 * for support purposes. That is deliberate and mirrors api#132: absence of a name is a different fact from a name we
 * cannot show, and folding them together would repeat the defect the server just fixed.
 */
const REPORT_FAILURE_KEYS: Record<ReportFailureReason, ReportFailureMessageKey> = {
  engine_error: 'kundali.reports.failureReason.engine_error',
  ephemeris_unavailable: 'kundali.reports.failureReason.ephemeris_unavailable',
  timezone_unresolvable: 'kundali.reports.failureReason.timezone_unresolvable',
  unsupported_capability: 'kundali.reports.failureReason.unsupported_capability',
  birth_date_out_of_range: 'kundali.reports.failureReason.birth_date_out_of_range',
  superseded_by_profile_edit: 'kundali.reports.failureReason.superseded_by_profile_edit',
};

/** Message keys this module can return. Declared here so the module has no dependency on the catalog package. */
export type ReportFailureMessageKey =
  | 'kundali.reports.failureReason.engine_error'
  | 'kundali.reports.failureReason.ephemeris_unavailable'
  | 'kundali.reports.failureReason.timezone_unresolvable'
  | 'kundali.reports.failureReason.unsupported_capability'
  | 'kundali.reports.failureReason.birth_date_out_of_range'
  | 'kundali.reports.failureReason.superseded_by_profile_edit'
  | 'kundali.reports.failureReason.unrecognised';

/** Whether a wire reason is one the client has a sentence for. */
export function isRecognisedReportFailureReason(reason: string): reason is ReportFailureReason {
  return (reportFailureReasonValues as readonly string[]).includes(reason);
}

/**
 * A wire reason as a catalog key.
 *
 * Takes `string`, not `ReportFailureReason`, because the value comes off the wire: an unknown code must render as an
 * explicit "not recognised" sentence rather than crash the panel or print server prose. The exhaustive map above is what
 * guarantees every reason the union allows has a real key; this function only decides what to do with one it has never
 * seen.
 */
export function reportFailureReasonKey(reason: string): ReportFailureMessageKey {
  return isRecognisedReportFailureReason(reason)
    ? REPORT_FAILURE_KEYS[reason]
    : 'kundali.reports.failureReason.unrecognised';
}
