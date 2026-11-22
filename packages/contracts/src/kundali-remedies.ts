import { z } from 'zod';

/**
 * KUN-16 optional traditional remedies, contract only.
 *
 * Derived from the shipped API contract at aprraju/myvedicstar `cdcb3fc`:
 *   `KundaliRemediesResponse`, `KundaliRemedyResponse`, `KundaliUnsupportedResponse`
 *   (shared: `KundaliRemediesSection`, `KundaliRemedy`, `KundaliRemedyFindingStatus`, `RemedyOutcome`, `RemedyReason`)
 *   `GET /api/v1/kundali/{profileId}/sections/remedies`
 *
 * Two properties this contract refuses to let the UI flatten, both taken from the API's own reasoning:
 *
 * 1. **`findingStatus` is per item and parsed, never cast.** The server emits the status as a string precisely because
 *    a C# enum accepts any integer, so an unrecognised state would otherwise become constructible and reach the render
 *    path. Here the same rule is expressed as a closed zod enum with an explicit fallback to `unknown-code` in
 *    `parseRemedyFindingStatus`. A status the client cannot read must never promote a remedy into the rendered set.
 *
 * 2. **Only `evaluated` may carry a remedy.** The other statuses are shipped so a client can assert that rule against
 *    a stored response. `remediesThatMayRender` is that assertion, and it lives beside the schema rather than in a
 *    component so it cannot be bypassed by a renderer that forgets it.
 *
 * `catalogVersion` is required, not optional: a remedy rendered from a catalogue that changed under a cached response
 * is the same defect as a stale bindu count.
 */

/** The closed set of finding statuses the API can send. Wire text is stable; changing one is a contract change. */
export const kundaliRemedyFindingStatusValues = [
  'evaluated',
  'not-evaluated',
  'withheld',
  'unknown-code',
] as const;

export const kundaliRemedyFindingStatusSchema = z.enum(kundaliRemedyFindingStatusValues);
export type KundaliRemedyFindingStatus = z.infer<typeof kundaliRemedyFindingStatusSchema>;

/**
 * Parses wire text, falling back to `unknown-code` for anything unrecognised.
 *
 * The fallback is deliberately not `evaluated`: an unreadable status must not be able to promote a remedy into the
 * rendered set. Refusing to parse is a claim about the catalogue, which is a safer default than a claim that the
 * finding was assessed.
 */
export function parseRemedyFindingStatus(text: string): KundaliRemedyFindingStatus {
  const parsed = kundaliRemedyFindingStatusSchema.safeParse(text.trim().toLowerCase());
  return parsed.success ? parsed.data : 'unknown-code';
}

/**
 * One remedy, bound to the finding it addresses.
 *
 * `findingCode` is a stable namespaced key (for example `yoga:gaja-kesari`), never a display label. `tradition` and
 * `reference` are required per item, not per section: a remedy with no attributed tradition or source is an assertion
 * the product cannot stand behind.
 */
export const kundaliRemedySchema = z.object({
  findingCode: z.string().min(1),
  /** Kept as the raw wire string here; read it through `parseRemedyFindingStatus`. */
  findingStatus: z.string().min(1),
  category: z.string().min(1),
  suggestion: z.string().min(1),
  tradition: z.string().min(1),
  reference: z.string().min(1),
});
export type KundaliRemedy = z.infer<typeof kundaliRemedySchema>;

/** A finding or catalogue entry the server reports as suppressed, using the shared section reason vocabulary. */
export const kundaliRemedyUnsupportedSchema = z.object({
  path: z.string().min(1),
  reason: z.string().min(1),
});
export type KundaliRemedyUnsupported = z.infer<typeof kundaliRemedyUnsupportedSchema>;

/**
 * The remedy section for one profile.
 *
 * An empty `items` with an empty `unsupported` is a real answer: no finding applies, and nothing was withheld. An
 * empty `items` with entries in `unsupported` is a different answer, and the section must say which one it is -
 * otherwise a reader cannot distinguish "nothing applies" from "the engine could not assess it".
 */
export const kundaliRemediesSectionSchema = z.object({
  catalogVersion: z.string().min(1),
  items: z.array(kundaliRemedySchema),
  unsupported: z.array(kundaliRemedyUnsupportedSchema),
});
export type KundaliRemediesSection = z.infer<typeof kundaliRemediesSectionSchema>;

/**
 * The only remedies a renderer may show: those whose finding the engine actually evaluated.
 *
 * This is a render-time assertion over the payload, not a filter the client substitutes for the server's own rule. The
 * server refuses to attach a remedy to a withheld or unevaluated finding; this function exists so that a stored or
 * tampered response cannot make the client the place where that rule is broken.
 */
export function remediesThatMayRender(section: KundaliRemediesSection): KundaliRemedy[] {
  return section.items.filter((item) => parseRemedyFindingStatus(item.findingStatus) === 'evaluated');
}

/**
 * Remedies the server sent but whose status forbids rendering, paired with the status that forbade it.
 *
 * These are counted and reported rather than silently dropped: a payload that carries a non-evaluated remedy is a real
 * fact about the data, and hiding it would make the section claim a cleanliness it has not verified.
 */
export function remediesSuppressedByStatus(
  section: KundaliRemediesSection,
): { remedy: KundaliRemedy; status: KundaliRemedyFindingStatus }[] {
  return section.items
    .map((remedy) => ({ remedy, status: parseRemedyFindingStatus(remedy.findingStatus) }))
    .filter((entry) => entry.status !== 'evaluated');
}
