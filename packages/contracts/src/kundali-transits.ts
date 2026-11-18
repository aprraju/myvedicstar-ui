import { z } from 'zod';

/**
 * KUN-13 transit, Sade Sati and alert-subscription contract.
 *
 * Derived from the **merged** API contract at aprraju/myvedicstar `cc89b640` (PR #112):
 *   `KundaliTransitsSectionResponse`, `KundaliTransitGrahaResponse`, `KundaliTransitWindowResponse`,
 *   `KundaliSadeSatiResponse`, `KundaliSadeSatiPhaseResponse`, `KundaliDatedTransitResponse`,
 *   `KundaliAlertsResponse`, `KundaliAlertSubscriptionRequest`.
 *   `GET  /api/v1/kundali/{profileId}/sections/transits`
 *   `GET  /api/v1/kundali/{profileId}/alerts`
 *   `PUT  /api/v1/kundali/{profileId}/alerts`
 *
 * Two properties this contract refuses to let the UI flatten:
 *
 * 1. **`saturn`, `jupiter` and `sadeSati` are nullable.** Absent means the engine could not evaluate that graha or that
 *    the profile is not in a Sade Sati window at all - it does NOT mean "zero degrees" or "not retrograde". The schema
 *    keeps them null rather than defaulting, so a renderer that wants a value has to handle the absence explicitly.
 *
 * 2. **`sadeSati.isPartial` means the interval was truncated at a search edge.** The reported window is real as far as
 *    it goes, but the engine did not observe the whole phase, so neither the start nor the end can be presented as the
 *    phase boundary. This flag is required, not optional: an interval with no statement about its own truncation is not
 *    parseable.
 *
 * Transit windows are **start inclusive, end exclusive** - a boundary instant belongs to exactly one window. That rule
 * lives in the API contract comments and is repeated here because the UI formats these instants and off-by-one at a
 * boundary is a user-visible date error.
 */

/** A transit interval over one sign. `startUtc` is inclusive; `endUtc` is exclusive. */
export const kundaliTransitWindowSchema = z.object({
  sign: z.string().min(1),
  startUtc: z.string().datetime({ offset: true }),
  endUtc: z.string().datetime({ offset: true }),
});
export type KundaliTransitWindow = z.infer<typeof kundaliTransitWindowSchema>;

/**
 * One graha's current transit. `longitude` and `isRetrograde` are optional because the engine may not have been able
 * to evaluate them for a given profile; absent is absent.
 */
export const kundaliTransitGrahaSchema = z.object({
  graha: z.string().min(1),
  sign: z.string().min(1),
  longitude: z.number().nullable(),
  isRetrograde: z.boolean().nullable(),
  windows: z.array(kundaliTransitWindowSchema),
});
export type KundaliTransitGraha = z.infer<typeof kundaliTransitGrahaSchema>;

/** One phase of a Sade Sati cycle over one sign. */
export const kundaliSadeSatiPhaseSchema = z.object({
  phase: z.string().min(1),
  sign: z.string().min(1),
  startUtc: z.string().datetime({ offset: true }),
  endUtc: z.string().datetime({ offset: true }),
});
export type KundaliSadeSatiPhase = z.infer<typeof kundaliSadeSatiPhaseSchema>;

/**
 * Sade Sati as observed for this profile.
 *
 * `isPartial` is REQUIRED and load-bearing: a truncated observation is not a whole phase, and the UI must say so rather
 * than print a boundary the engine never saw.
 */
export const kundaliSadeSatiSchema = z.object({
  phase: z.string().min(1),
  active: z.boolean(),
  moonSign: z.string().min(1),
  startUtc: z.string().datetime({ offset: true }),
  endUtc: z.string().datetime({ offset: true }),
  isPartial: z.boolean(),
  phases: z.array(kundaliSadeSatiPhaseSchema),
});
export type KundaliSadeSati = z.infer<typeof kundaliSadeSatiSchema>;

/** A dated ingress or egress event, as the engine recorded it. */
export const kundaliDatedTransitSchema = z.object({
  graha: z.string().min(1),
  eventType: z.string().min(1),
  sign: z.string().min(1),
  atUtc: z.string().datetime({ offset: true }),
});
export type KundaliDatedTransit = z.infer<typeof kundaliDatedTransitSchema>;

/** A withheld element, using the shared section reason vocabulary. */
export const kundaliTransitUnsupportedSchema = z.object({
  path: z.string().min(1),
  reason: z.string().min(1),
});
export type KundaliTransitUnsupported = z.infer<typeof kundaliTransitUnsupportedSchema>;

/**
 * The transit section.
 *
 * Freshness is not implied: `referenceInstant` is the instant the numbers describe, `computedAt` when they were
 * produced and `expiresAt` when the client should stop treating them as current. The UI renders all three rather than
 * presenting an undated value.
 */
export const kundaliTransitsSectionSchema = z.object({
  referenceInstant: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  computedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  saturn: kundaliTransitGrahaSchema.nullable(),
  jupiter: kundaliTransitGrahaSchema.nullable(),
  sadeSati: kundaliSadeSatiSchema.nullable(),
  datedTransits: z.array(kundaliDatedTransitSchema),
  unsupported: z.array(kundaliTransitUnsupportedSchema),
});
export type KundaliTransitsSection = z.infer<typeof kundaliTransitsSectionSchema>;

/**
 * Alert channel. The API accepts email only today - a subscription request names a channel so that adding another
 * transport later is not a breaking change, but a client must not invent one.
 */
export const kundaliAlertChannelValues = ['email'] as const;
export const kundaliAlertChannelSchema = z.enum(kundaliAlertChannelValues);
export type KundaliAlertChannel = z.infer<typeof kundaliAlertChannelSchema>;

/** An event type the engine can notify about. */
export const kundaliAlertEventTypeSchema = z.string().min(1);
export type KundaliAlertEventType = z.infer<typeof kundaliAlertEventTypeSchema>;

/** What a client sends to replace its subscriptions for one profile. */
export const kundaliAlertSubscriptionRequestSchema = z.object({
  eventTypes: z.array(kundaliAlertEventTypeSchema),
  channel: kundaliAlertChannelSchema,
});
export type KundaliAlertSubscriptionRequest = z.infer<typeof kundaliAlertSubscriptionRequestSchema>;

/** What the server reports back. An empty list is a real answer: subscribed to nothing. */
export const kundaliAlertsSchema = z.object({
  subscriptions: z.array(
    z.object({
      eventTypes: z.array(kundaliAlertEventTypeSchema),
      channel: kundaliAlertChannelSchema,
    }),
  ),
});
export type KundaliAlerts = z.infer<typeof kundaliAlertsSchema>;
