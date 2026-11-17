import type { MessageKey } from '@myvedicstar/localization';

/**
 * Builds a catalog key from a stable prefix and a runtime value (an API error kind, a wire enum name).
 *
 * The catalog is a literal-typed map, so a template string is not assignable to MessageKey on its own; the cast is
 * confined here — every prefix passed in is a real catalog group, and an unknown suffix falls back to the group's
 * default in the translator rather than rendering a raw key.
 */
export function toFriendlyKey(prefix: 'errors' | 'vedicProfiles.relationship', suffix: string): MessageKey {
  return `${prefix}.${suffix}` as MessageKey;
}
