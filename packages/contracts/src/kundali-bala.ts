import { z } from 'zod';

/**
 * KUN-12 Shadbala and Bhava Bala contract.
 *
 * Derived from the **merged** API contract at aprraju/myvedicstar `4217930` (PR #114):
 *   `KundaliBalaResponse` → `KundaliShadbalaPlanetResponse`, `KundaliBhavaBalaHouseResponse`,
 *   `KundaliUnsupportedResponse`, and the engine's `Shadbala.ComponentStates` vocabulary.
 *   `GET /api/v1/kundali/{profileId}/sections/bala`
 *
 * The load-bearing rule of this section: **a Shadbala total is partial, and the payload makes it impossible to present
 * it as complete.**
 *
 * Chesta Bala is withheld by the engine (ADR-0016 §3, `UnsupportedShadbalaComponents = ["Chesta"]`), and Dig Bala is
 * emitted as a PLACEHOLDER because it needs a validated ascendant. A placeholder zero and a computed zero are the same
 * number, so the only thing that distinguishes them is `componentStates` — which is why this contract requires it and
 * the UI must read it rather than trusting the numeric value.
 *
 * Three independent mechanisms keep that honest, none of which trusts a single server flag:
 *  1. `componentsWithheld` and `componentsInTotal` and `componentsExcludedFromTotal` are REQUIRED. A total with no
 *     statement of which components it sums cannot be parsed.
 *  2. `totalIsComplete` is DERIVED here from `componentsInTotal` against the classical six, so a section that claims
 *     `complete: true` while omitting a component is rejected rather than rendered.
 *  3. `componentStates` must cover every key in `components`, and a `placeholder` component must not be listed in
 *     `componentsInTotal`: a zero by flag can never contribute to a total.
 */

/** The six classical Shadbala components, in the engine's own canonical order. */
export const shadbalaComponentValues = ['sthana', 'dig', 'kala', 'chesta', 'naisargika', 'drik'] as const;
export const shadbalaComponentSchema = z.enum(shadbalaComponentValues);
export type ShadbalaComponent = z.infer<typeof shadbalaComponentSchema>;

/** Every component a complete classical Shadbala has. Completeness is judged against this, not against what was sent. */
export const CLASSICAL_SHADBALA_COMPONENTS: readonly ShadbalaComponent[] = shadbalaComponentValues;

/**
 * The engine's machine-readable component state (`Shadbala.ComponentStates`).
 *
 * `computed` is a measurement; `withheld` is not producible (it carries a value for shape only); `placeholder`
 * occupies the slot without being the classical quantity. Only `computed` may contribute to a total.
 */
export const componentStateValues = ['computed', 'withheld', 'placeholder'] as const;
export const componentStateSchema = z.enum(componentStateValues);
export type ComponentState = z.infer<typeof componentStateSchema>;

/**
 * Component names arrive as strings from the engine, not as an enum: the vocabulary is versioned server data
 * (`rulesVersion` identifies it), and a new component must render as an unreconciled name rather than crash the
 * section. The closed classical set above is what completeness is measured against.
 */
const componentName = z.string().min(1);

/** Reasons for a withheld element, using the shared section reason vocabulary. */
export const balaUnsupportedSchema = z.object({
  path: z.string().min(1),
  reason: z.string().min(1),
});
export type BalaUnsupported = z.infer<typeof balaUnsupportedSchema>;

export const shadbalaEntrySchema = z
  .object({
    planet: z.string().min(1),
    /** rupas by component name. Never summed by the UI: `total` is the engine's number. */
    components: z.record(componentName, z.number()),
    /** Machine-readable state per component. Required, because a placeholder zero is numerically a zero. */
    componentStates: z.record(componentName, componentStateSchema),
    /** The engine's total, rendered as-is. */
    total: z.number(),
    /** Classical required rupas for this planet, when the rule set publishes one. Absent means no basis, not zero. */
    requiredRupas: z.number().positive().optional(),
    /** total / requiredRupas. Absent when there is no basis, rather than defaulting to 1. */
    ratioToThreshold: z.number().nonnegative().optional(),
    /** Classical components the engine does not compute. Empty only when the total really is complete. */
    componentsWithheld: z.array(componentName),
    /** Exactly which components the total sums. */
    componentsInTotal: z.array(componentName),
    /** Components present in the breakdown that contribute no strength (placeholder / withheld). */
    componentsExcludedFromTotal: z.array(componentName),
  })
  .superRefine((entry, ctx) => {
    const present = new Set(Object.keys(entry.components));
    const inTotal = new Set(entry.componentsInTotal);
    const excluded = new Set(entry.componentsExcludedFromTotal);

    // Every component that carries a number must carry a state, or a placeholder would be indistinguishable from a
    // measurement at the moment it is rendered.
    for (const component of present) {
      if (entry.componentStates[component] === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `component "${component}" has a value but no state`,
          path: ['componentStates'],
        });
      }
    }

    // A state for a component that is not in the breakdown is an unrenderable claim.
    for (const component of Object.keys(entry.componentStates)) {
      if (!present.has(component)) {
        ctx.addIssue({
          code: 'custom',
          message: `component "${component}" has a state but no value`,
          path: ['componentStates'],
        });
      }
    }

    // A placeholder is a zero BY FLAG, not by measurement: it must never contribute to a total.
    for (const component of present) {
      if (entry.componentStates[component] === 'placeholder' && inTotal.has(component)) {
        ctx.addIssue({
          code: 'custom',
          message: `placeholder component "${component}" is listed as contributing to the total`,
          path: ['componentsInTotal'],
        });
      }
    }

    // Withheld and placeholder components are exactly the excluded ones: the two lists must agree in both directions.
    for (const component of entry.componentsExcludedFromTotal) {
      const state = entry.componentStates[component];
      if (state === 'computed') {
        ctx.addIssue({
          code: 'custom',
          message: `component "${component}" is excluded from the total but is marked computed`,
          path: ['componentsExcludedFromTotal'],
        });
      }
      if (!present.has(component) && !entry.componentsWithheld.includes(component)) {
        ctx.addIssue({
          code: 'custom',
          message: `component "${component}" is excluded from the total but is neither present nor withheld`,
          path: ['componentsExcludedFromTotal'],
        });
      }
    }

    for (const component of entry.componentsInTotal) {
      if (!present.has(component)) {
        ctx.addIssue({
          code: 'custom',
          message: `component "${component}" contributes to the total but has no value`,
          path: ['componentsInTotal'],
        });
      }
      if (excluded.has(component)) {
        ctx.addIssue({
          code: 'custom',
          message: `component "${component}" is both in and excluded from the total`,
          path: ['componentsInTotal'],
        });
      }
    }

    // A ratio with no basis is a number with no meaning.
    if (entry.ratioToThreshold !== undefined && entry.requiredRupas === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'ratioToThreshold requires requiredRupas',
        path: ['ratioToThreshold'],
      });
    }
  });
export type ShadbalaEntry = z.infer<typeof shadbalaEntrySchema>;

/**
 * Completeness of one planet's total, derived from `componentsInTotal` against the classical six.
 *
 * Returned as a value, so a renderer cannot receive "a number and a boolean I hope is right": a complete total carries
 * no missing list because there is none, and a partial total must carry the names it lacks.
 */
export type TotalCompleteness = { kind: 'complete' } | { kind: 'partial'; missing: readonly string[] };

export function completenessOf(entry: ShadbalaEntry): TotalCompleteness {
  const counted = new Set(entry.componentsInTotal);
  const missing = CLASSICAL_SHADBALA_COMPONENTS.filter((component) => !counted.has(component));
  if (missing.length > 0) return { kind: 'partial', missing };

  // The engine's own withheld list is unioned in: a component it declares uncomputable is missing from the total even
  // if a future rule set were to name it as counted.
  const declared = entry.componentsWithheld.filter((component) => !counted.has(component));
  return declared.length === 0 ? { kind: 'complete' } : { kind: 'partial', missing: declared };
}

/** True when the section-level `complete` claim agrees with what the planets actually report. */
export function sectionComplete(section: KundaliBala): boolean {
  return section.shadbala.every((entry) => completenessOf(entry).kind === 'complete');
}

export const bhavaBalaEntrySchema = z.object({
  /** 1-12. Whole-sign Bhava Chalit per the owner's approved default. */
  house: z.number().int().min(1).max(12),
  components: z.record(componentName, z.number()),
  total: z.number(),
});
export type BhavaBalaEntry = z.infer<typeof bhavaBalaEntrySchema>;

export const kundaliBalaSchema = z
  .object({
    rulesVersion: z.string().min(1),
    /** The strength unit, echoed by the engine so a consumer never assumes. */
    unit: z.string().min(1),
    /**
     * The engine's own completeness claim for the section. Kept in the schema and rendered as context, but the UI
     * derives partiality per planet from `componentsInTotal` — a claim that disagrees with the data is a calculation
     * error, caught below rather than displayed.
     */
    complete: z.boolean(),
    shadbala: z.array(shadbalaEntrySchema),
    /** Bhava Bala is a separate measure and is never added to Shadbala. */
    bhavaBala: z.array(bhavaBalaEntrySchema),
    unsupported: z.array(balaUnsupportedSchema),
  })
  .superRefine((value, ctx) => {
    // A section that claims completeness while a planet's counted components are short of the classical six would be
    // printed as a full Shadbala by any consumer reading only the flag. Reject the disagreement here.
    if (value.complete && value.shadbala.some((entry) => completenessOf(entry).kind === 'partial')) {
      ctx.addIssue({
        code: 'custom',
        message: 'section claims complete but a planet total excludes classical components',
        path: ['complete'],
      });
    }

    // Two rows for one planet would collapse in the table and hide one of them.
    const seen = new Set<string>();
    for (const entry of value.shadbala) {
      const key = entry.planet.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate shadbala row for "${entry.planet}"`,
          path: ['shadbala'],
        });
      }
      seen.add(key);
    }
  });
export type KundaliBala = z.infer<typeof kundaliBalaSchema>;
