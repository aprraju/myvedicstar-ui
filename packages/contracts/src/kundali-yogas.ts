import { z } from 'zod';

/**
 * KUN-10 yoga and dosha assessment contract.
 *
 * Binding shape from the architect (2026-11-17):
 *   `GET /api/v1/kundali/{profileId}/sections/yogas` →
 *   [{ code, name, scope, status, conditions[{text, truth}], supporting[], opposing[], exceptions[],
 *      cancellations[], ruleSetVersion }]
 *
 * Load-bearing rules:
 *  - `status` is a three-way answer, not a boolean. `not-satisfied` (the engine looked and it does not hold) and
 *    `indeterminate` (the engine could not decide, usually because the birth time is unknown) are different facts and
 *    the UI must never flatten them into "no".
 *  - `scope` separates natal findings from transit findings. A transit finding carries the instant it was referenced
 *    at and is never presented as permanent.
 *  - Names and rule text come from the engine's versioned rule catalogue and are displayed as rule vocabulary, not
 *    generated UI copy. Every list is keyed by stable codes so wording changes never require regeneration.
 *  - The section-level availability discriminators are shared with the other assessment sections
 *    (`kundali-assessment.ts`) so the page shell, reason codes and tests are identical across sections.
 */

/**
 * Whether an assessment section could be produced at all.
 *
 * `computed` means the engine produced the section. `unsupported` is a first-class state: the section is absent because
 * the engine cannot evaluate it, and `reason` says why. The renderer is given this union instead of an empty list, so
 * "nothing to show" can never look like "nothing found".
 */
export const assessmentAvailabilityValues = [
  'computed',
  'unsupported',
  'stale',
  'not-found',
  'error',
] as const;
export const assessmentAvailabilitySchema = z.enum(assessmentAvailabilityValues);
export type AssessmentAvailability = z.infer<typeof assessmentAvailabilitySchema>;

/**
 * Why a section or a single assessment is unavailable. Localizable codes, never prose.
 *
 * `engine-unavailable` and `rule-not-implemented` are separate on purpose: the first is the calculation service not
 * answering, the second is the engine deliberately not supporting this rule family yet. Only the second is expected
 * to change as the engine grows, so the user-facing wording differs.
 */
export const assessmentReasonValues = [
  'engine-unavailable',
  'rule-not-implemented',
  'rule-set-version-missing',
  'postponed',
  'not-in-scope',
  'storage-disabled',
  'birth-time-unknown',
  'birth-time-approximate',
  'birth-data-incomplete',
  'chart-style-unsupported',
  'transit-data-unavailable',
  'reference-date-invalid',
  'reconciliation-failed',
  'unknown',
] as const;
export const assessmentReasonSchema = z.enum(assessmentReasonValues);
export type AssessmentReason = z.infer<typeof assessmentReasonSchema>;

/** `natal` findings describe the birth chart; `transit` findings describe a moving sky at a reference instant. */
export const assessmentScopeValues = ['natal', 'transit'] as const;
export const assessmentScopeSchema = z.enum(assessmentScopeValues);
export type AssessmentScope = z.infer<typeof assessmentScopeSchema>;

/** Three-way verdict. `indeterminate` is not a soft `not-satisfied`. */
export const assessmentStatusValues = ['satisfied', 'not-satisfied', 'indeterminate'] as const;
export const assessmentStatusSchema = z.enum(assessmentStatusValues);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

/** Outcome of one tested condition. `unknown` means the placement the condition needs is itself indeterminate. */
export const conditionTruthValues = ['true', 'false', 'unknown'] as const;
export const conditionTruthSchema = z.enum(conditionTruthValues);
export type ConditionTruth = z.infer<typeof conditionTruthSchema>;

/**
 * Families the owner named in KUN-10. `family` is the stable identifier; `name` is rule-set text.
 */
export const yogaFamilyCodes = [
  'raja',
  'dhana',
  'gaja-kesari',
  'panch-mahapurusha',
  'manglik',
  'kaal-sarp',
  'pitra',
] as const;
export const yogaFamilyCodeSchema = z.enum(yogaFamilyCodes);
export type YogaFamilyCode = z.infer<typeof yogaFamilyCodeSchema>;

export const assessmentConditionSchema = z.object({
  /** Stable condition identifier within its rule set, so the UI can key and test it. */
  code: z.string().min(1),
  /** Rule-set wording for the condition, e.g. "Jupiter in a kendra from the Moon". */
  text: z.string().min(1),
  truth: conditionTruthSchema,
});
export type AssessmentCondition = z.infer<typeof assessmentConditionSchema>;

/**
 * A placement or factor that argued for or against the assessment. `code` is the stable identifier; `text` is the
 * rule-set rendering of it (e.g. "Saturn in the 7th house").
 */
export const assessmentFactorSchema = z.object({
  code: z.string().min(1),
  text: z.string().min(1),
});
export type AssessmentFactor = z.infer<typeof assessmentFactorSchema>;

/**
 * One assessment. `key` is unique inside the response so an expandable row can be identified and a test can name it.
 *
 * `ruleSetVersion` is part of the assessment, not of the page, so a mixed payload (two rule families at different
 * versions) is representable and is rendered per row rather than pretending one version covers everything.
 */
export const yogaAssessmentSchema = z.object({
  key: z.string().min(1),
  family: yogaFamilyCodeSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  scope: assessmentScopeSchema,
  status: assessmentStatusSchema,
  conditions: z.array(assessmentConditionSchema),
  supporting: z.array(assessmentFactorSchema),
  opposing: z.array(assessmentFactorSchema),
  exceptions: z.array(assessmentFactorSchema),
  cancellations: z.array(assessmentFactorSchema),
  ruleSetVersion: z.string().min(1),
  /**
   * Present only for `scope: 'transit'`. The reference instant the moving sky was sampled at, rendered in the
   * profile's zone. A natal assessment must not carry one, and a transit assessment must not omit one.
   */
  referenceInstant: z.string().datetime({ offset: true }).optional(),
});
export type YogaAssessment = z.infer<typeof yogaAssessmentSchema>;

/**
 * A rule family the engine knows about but did not evaluate. The reason is a code; the UI words it. This is what makes
 * "you own seven families and four have rules so far" visible, instead of silently returning four rows.
 */
export const yogaFamilySupportSchema = z.object({
  family: yogaFamilyCodeSchema,
  available: z.boolean(),
  /** Present only when `available` is false. */
  reason: assessmentReasonSchema.optional(),
  /** Rule-set version that would evaluate this family, when known. */
  ruleSetVersion: z.string().min(1).optional(),
});
export type YogaFamilySupport = z.infer<typeof yogaFamilySupportSchema>;

export const kundaliYogasSchema = z
  .object({
    /** Section-level availability. `unsupported` with a reason is the day-one state, never an empty array alone. */
    availability: assessmentAvailabilitySchema,
    /** Present when `availability` is not 'computed'. */
    reason: assessmentReasonSchema.optional(),
    assessments: z.array(yogaAssessmentSchema),
    /** Coverage per owned family: which of Raja/Dhana/Gaja Kesari/... this payload can speak to. */
    families: z.array(yogaFamilySupportSchema),
    /** Rule-set versions this payload was produced with, for provenance. */
    ruleSetVersions: z.array(z.string().min(1)),
  })
  .superRefine((value, ctx) => {
    // An unavailable section with no explanation, or an available one carrying a reason, is a contract violation: the
    // UI would otherwise have to guess which half of the payload to believe.
    if (value.availability !== 'computed' && !value.reason) {
      ctx.addIssue({
        code: 'custom',
        message: 'an assessment section that is not computed requires a reason',
      });
    }
    if (value.availability === 'computed' && value.reason !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'a computed section must not carry an unavailability reason' });
    }

    // Duplicate keys would collapse rows in the list and hide an assessment from the user.
    const seen = new Set<string>();
    for (const assessment of value.assessments) {
      if (seen.has(assessment.key)) {
        ctx.addIssue({ code: 'custom', message: `duplicate assessment key "${assessment.key}"` });
      }
      seen.add(assessment.key);
    }

    for (const assessment of value.assessments) {
      if (assessment.scope === 'transit' && !assessment.referenceInstant) {
        ctx.addIssue({
          code: 'custom',
          message: `transit assessment "${assessment.key}" requires referenceInstant`,
        });
      }
      if (assessment.scope === 'natal' && assessment.referenceInstant !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `natal assessment "${assessment.key}" must not carry referenceInstant`,
        });
      }
      // An indeterminate verdict that lists no unknown condition is unexplained: the user would see "cannot decide"
      // with nothing to expand and no way to learn why.
      if (
        assessment.status === 'indeterminate' &&
        !assessment.conditions.some((c) => c.truth === 'unknown')
      ) {
        ctx.addIssue({
          code: 'custom',
          message: `indeterminate assessment "${assessment.key}" requires at least one unknown condition`,
        });
      }
      if (assessment.status !== 'indeterminate' && assessment.conditions.some((c) => c.truth === 'unknown')) {
        ctx.addIssue({
          code: 'custom',
          message: `assessment "${assessment.key}" has unknown conditions but a definite status`,
        });
      }
    }

    for (const family of value.families) {
      if (!family.available && !family.reason) {
        ctx.addIssue({ code: 'custom', message: `unavailable family "${family.family}" requires a reason` });
      }
    }
  });
export type KundaliYogas = z.infer<typeof kundaliYogasSchema>;
