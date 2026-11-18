import { z } from 'zod';

import { unsupportedEntrySchema } from './kundali-overview';

/**
 * KUN-08 planetary detail contract.
 *
 * Binding shape from the architect refinement on aprraju/myvedicstar#18:
 * `GET /api/v1/kundali/{profileId}/sections/planets` → `{ houseSystem, aspectMethod, planets[], uncertainty }`.
 *
 * Three rules are load-bearing and are enforced by the schema rather than by convention:
 *  - A planet's fact that the engine could not compute is **absent**, never null, never `'-'`, never `0`. Each planet
 *    carries its own `unsupported` entries so a single row can be explained while the rest of the table is complete.
 *  - Method identifiers (`houseSystem`, `aspectMethod`) are **required strings**. A payload that omits them cannot be
 *    parsed, so the UI can never show house or aspect facts without naming the method that produced them (AC2).
 *  - Every uncertain fact carries a localizable CODE; the server never sends prose for display.
 *
 * On the API's "uncertainty per planet": rather than a second parallel union shape per planet, the planet's
 * `unsupported` array IS that per-planet uncertainty, using the same `{ path, reason }` entries the overview already
 * uses. `path` is relative to the planet, e.g. `nakshatra`, `house`, `dignity`, `aspects`. One vocabulary across
 * sections means the overview's reason mapping applies unchanged.
 */

/** Dignity of a planet in the sign it occupies. A closed set: the engine asserts one, or the field is absent. */
export const dignityValues = [
  'exalted',
  'moolatrikona',
  'own-sign',
  'friendly',
  'neutral',
  'enemy',
  'debilitated',
] as const;
export const dignitySchema = z.enum(dignityValues);
export type Dignity = z.infer<typeof dignitySchema>;

/** The grahas and nodes a detail table can contain. Chhaya grahas are out of scope until the engine adds them. */
export const planetValues = [
  'sun',
  'moon',
  'mars',
  'mercury',
  'jupiter',
  'venus',
  'saturn',
  'rahu',
  'ketu',
] as const;
export const planetSchema = z.enum(planetValues);
export type Planet = z.infer<typeof planetSchema>;

/** Aspect types as named by the engine's aspect method; the method itself is stated at section level. */
export const aspectTypeValues = [
  'full',
  'three-quarter',
  'half',
  'quarter',
  'conjunction',
  'opposition',
] as const;
export const aspectTypeSchema = z.enum(aspectTypeValues);
export type AspectType = z.infer<typeof aspectTypeSchema>;

/**
 * One aspect from this planet to another. `orb` is a number of degrees; it is absent when the engine's method does not
 * report an orb, so a rendering code cannot print `0°` for "not measured".
 */
export const planetAspectSchema = z.object({
  to: planetSchema,
  type: aspectTypeSchema,
  orb: z.number().min(0).max(180).optional(),
});
export type PlanetAspect = z.infer<typeof planetAspectSchema>;

/**
 * One row of the detail table.
 *
 * `longitude` is the normalized sidereal longitude in degrees [0, 360) and `degreeInSign` the derived position in
 * [0, 30) — both are quantities the engine computed, and both are optional so an engine that only knows the sign still
 * produces a valid row. The UI never derives one from the other.
 */
export const planetDetailSchema = z.object({
  planet: planetSchema,
  /** Normalized sidereal longitude, degrees in [0, 360). */
  longitude: z.number().min(0).lt(360).optional(),
  sign: z.string().min(1).optional(),
  degreeInSign: z.number().min(0).lt(30).optional(),
  nakshatra: z.string().min(1).optional(),
  /** 1–4. Absent when the engine does not resolve padas. */
  pada: z.number().int().min(1).max(4).optional(),
  /** Whole-sign and house-system house numbers are both 1–12. */
  house: z.number().int().min(1).max(12).optional(),
  retrograde: z.boolean().optional(),
  combust: z.boolean().optional(),
  dignity: dignitySchema.optional(),
  /** Localizable relationship keys, e.g. `friendly`, `neutral`, `enemy` — codes, not prose. */
  relationships: z.array(z.string().min(1)).optional(),
  aspects: z.array(planetAspectSchema).optional(),
  /** Why a fact in THIS row is missing. Paths are planet-relative; see the section note above. */
  unsupported: z.array(unsupportedEntrySchema),
});
export type PlanetDetail = z.infer<typeof planetDetailSchema>;

export const kundaliPlanetsSchema = z.object({
  /** Named method, e.g. `whole-sign`. Required: AC2 forbids showing houses without naming the method. */
  houseSystem: z.string().min(1),
  /** Named method, e.g. `parashari-full-partial`. Required, for the same reason. */
  aspectMethod: z.string().min(1),
  planets: z.array(planetDetailSchema),
  /** Provenance for the section's calculation settings, snapshot at computation time. */
  conventions: z
    .object({
      ayanamsa: z.string().min(1),
      dignityScheme: z.string().min(1),
      combustionOrb: z.string().min(1),
      aspectMethod: z.string().min(1),
    })
    .optional(),
});
export type KundaliPlanets = z.infer<typeof kundaliPlanetsSchema>;
