/**
 * Dignity, planet, aspect and relationship vocabulary.
 *
 * The catalog's message keys are a closed, compile-time checked set. These identifiers arrive from the server, so they
 * are resolved at RUNTIME through `tDynamic`, which returns an explicit fallback for an identifier the catalog does not
 * know. That is what stops a server-side addition from printing a raw internal token such as
 * `kundali.planets.dignity.foo` to a user: an unknown value degrades to a readable label instead.
 */

import type { AspectType, Dignity, Planet } from '@myvedicstar/contracts';
import type { Translator } from '@myvedicstar/localization';

/** The translator object. `t` alone is not enough: these lookups are runtime, so they need `tDynamic` too. */
type Translate = Translator;

/** Display name of a graha. An unknown planet still needs a name, so the fallback is a neutral word, not the code. */
export function planetLabel(translator: Translate, planet: Planet): string {
  return translator.tDynamic(
    `kundali.planets.planet.${planet}`,
    undefined,
    translator.t('kundali.planets.unknownPlanet'),
  );
}

export function dignityLabel(translator: Translate, dignity: Dignity): string {
  return translator.tDynamic(
    `kundali.planets.dignity.${dignity}`,
    undefined,
    translator.t('kundali.planets.unknownValue'),
  );
}

export function aspectTypeLabel(translator: Translate, type: AspectType): string {
  return translator.tDynamic(
    `kundali.planets.aspectType.${type}`,
    undefined,
    translator.t('kundali.planets.unknownValue'),
  );
}

/** Relationship codes arrive as free strings, so an unrecognized one must read as a neutral label, never as the code. */
export function relationshipLabel(translator: Translate, code: string): string {
  return translator.tDynamic(
    `kundali.planets.relationship.${code}`,
    undefined,
    translator.t('kundali.planets.unknownValue'),
  );
}

/** The dignity ordering used by the legend: strongest to weakest, so colour and order agree. */
export const dignityScale: readonly Dignity[] = [
  'exalted',
  'moolatrikona',
  'own-sign',
  'friendly',
  'neutral',
  'enemy',
  'debilitated',
];
