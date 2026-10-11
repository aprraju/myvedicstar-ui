const HOUR = 60 * 60_000;

/** Freshness, unused-memory retention, and storage expiry are deliberately separate. */
export const cachePolicies = {
  default: { staleTime: 5 * 60_000, gcTime: 6 * HOUR },
  today: { gcTime: 24 * HOUR },
  panchang: { staleTime: 12 * HOUR, gcTime: 24 * HOUR },
  calendar: { staleTime: 12 * HOUR, gcTime: 24 * HOUR },
  goodTime: { staleTime: HOUR, gcTime: 6 * HOUR },
  liveBest: { staleTime: 5 * 60_000, gcTime: 6 * HOUR },
  catalog: { staleTime: 24 * HOUR, gcTime: 24 * HOUR },
  profile: { staleTime: 5 * 60_000, gcTime: 15 * 60_000 },
  persistence: { maxAge: 24 * HOUR, maxQueryBytes: 512 * 1024, maxTotalBytes: 2 * 1024 * 1024 },
} as const;

export interface CacheSettings {
  enabled: boolean;
  persist: boolean;
  prefetchTomorrow: boolean;
  schemaVersion: string;
  rulesVersion: string;
  calculationVersion: string;
}

export const defaultCacheSettings: CacheSettings = {
  enabled: true,
  persist: false,
  prefetchTomorrow: false,
  schemaVersion: '1',
  rulesVersion: '1',
  calculationVersion: '1',
};
