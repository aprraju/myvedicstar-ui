import type { ColorScheme } from './tokens';

type Key = keyof ColorScheme;

export type ContrastPair = readonly [Key, readonly Key[]];

/**
 * The text-on-surface pairings whose contrast the token suite MEASURES, in both schemes.
 *
 * Top-level and exported rather than local to `tokens.test.ts` (ui#83 review): a consumer that relies on a pairing can
 * then check its own copy against this list, so a drift between a transcribed copy and the measured source becomes a
 * named failure instead of a silent staleness. The type keeps every entry honest — a key that is not a `ColorScheme`
 * field, or a background that is, fails to compile here.
 */
export const TEXT_ON: readonly ContrastPair[] = [
  ['heroForeground', ['heroOverlay']],
  ['textPrimary', ['background', 'surface', 'surfaceElevated', 'surfaceSubtle']],
  ['textSecondary', ['background', 'surface', 'surfaceElevated', 'surfaceSubtle']],
  ['primary', ['background', 'surface']],
  ['secondary', ['background', 'surface']],
  ['onPrimary', ['primary', 'info']],
  ['onSecondary', ['secondary']],
  ['favorable', ['favorableSurface', 'surface', 'background']],
  ['favorableStrong', ['favorableStrongSurface', 'surface', 'background']],
  ['caution', ['cautionSurface', 'surface', 'background']],
  ['auspicious', ['auspiciousSurface', 'surface', 'background']],
  ['warning', ['warningSurface', 'surface', 'background']],
  ['info', ['infoSurface', 'surface', 'background']],
  ['error', ['errorSurface', 'surface', 'background']],
];
