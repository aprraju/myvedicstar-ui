import type { QueryKey } from '@tanstack/react-query';

import { type CacheSettings, defaultCacheSettings } from './policies';

export interface CacheScope {
  userId: string | null;
  schemaVersion: string;
  rulesVersion: string;
  calculationVersion: string;
}

/** Append a scope to existing endpoint keys; retain their prefixes for targeted invalidation. */
export function scopedKey(
  key: QueryKey,
  userId: string | null,
  settings: Pick<
    CacheSettings,
    'schemaVersion' | 'rulesVersion' | 'calculationVersion'
  > = defaultCacheSettings,
): QueryKey {
  return [
    ...key,
    {
      userId,
      schemaVersion: settings.schemaVersion,
      rulesVersion: settings.rulesVersion,
      calculationVersion: settings.calculationVersion,
    },
  ];
}

export function keyScope(key: QueryKey): CacheScope | undefined {
  const value = key.at(-1);
  if (
    value &&
    typeof value === 'object' &&
    'userId' in value &&
    'schemaVersion' in value &&
    'rulesVersion' in value &&
    'calculationVersion' in value &&
    (value.userId === null || typeof value.userId === 'string') &&
    typeof value.schemaVersion === 'string' &&
    typeof value.rulesVersion === 'string' &&
    typeof value.calculationVersion === 'string'
  )
    return value as CacheScope;
  return undefined;
}
