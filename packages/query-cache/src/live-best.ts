import type { BestGoodTimesResponse } from '@myvedicstar/contracts';
import { useEffect } from 'react';

/** Refresh at a calculated window boundary, rather than polling or retaining an ended "next" result. */
export function useRefreshAtWindowEnd(
  data: BestGoodTimesResponse | undefined,
  refetch: () => Promise<unknown>,
  enabled: boolean,
) {
  useEffect(() => {
    const now = Date.now();
    const upcomingEnds =
      data?.options.map((option) => Date.parse(option.segment.end)).filter((end) => end > now) ?? [];
    const expiresAt = upcomingEnds.length ? Math.min(...upcomingEnds) : undefined;
    if (!enabled || expiresAt === undefined) return;
    const delay = expiresAt - Date.now();
    // Long future windows are handled by the date rollover hook, not an overflowing JavaScript timer.
    if (delay < 0 || delay > 24 * 60 * 60_000) return;
    const timer = setTimeout(() => void refetch(), delay + 1);
    return () => clearTimeout(timer);
  }, [data, enabled, refetch]);
}
